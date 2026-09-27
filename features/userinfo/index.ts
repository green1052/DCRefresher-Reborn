import {UserRound} from "lucide-react";
import {objectKeys} from "ts-extras";

import {banReasonsOf, initDatabase, ipInfoOf, type IpInfoFilter, passesIpFilter, subscribeDatabase} from "@/core/database";
import {defineModule} from "@/core/module/define";
import type {ModuleContext, SettingGroup, SettingSchema, SettingsSchema} from "@/core/module/types";
import {fetchGallogActivity, type GallogActivity} from "@/core/gallog";
import {queryString} from "@/core/http/urls";
import {BOARD_PAGE} from "@/core/pages";
import {eventBus} from "@/core/eventbus/bus";
import {moduleDataStorage} from "@/core/storage/items";
import {findMemo, useMemosStore} from "@/stores/memos";
import {type BadgeView, DEFAULT_BADGE_VIEW, showsUid, useUiStore} from "@/stores/ui";
import {insertWriterSpan} from "@/utils/userDataInsert";

interface RatioInfo {
    article: number;
    comment: number;
    date: number;
}

/** 배지 색 기본값. 키마다 `${key}Color` 설정이 하나씩 생기고 옵션 화면에선 한 그룹으로 묶인다. IP 배지는 분류(korea…vpn)가 키다 */
const BADGE_COLORS = {
    uid: ["유저 ID / IP", "#999999"],
    ratio: ["글댓비", "#999999"],
    ratioAlarm: ["글댓비 경고", "#ff0000"],
    permBan: ["갱차", "#e8645f"],
    korea: ["IP 한국", "#6495ed"],
    japan: ["IP 일본", "#e5484d"],
    china: ["IP 중국", "#f76b15"],
    foreign: ["IP 그 외 해외", "#12a594"],
    vpn: ["IP VPN", "#8e4ec6"]
} satisfies Record<string, [name: string, color: string]>;

type BadgeColor = keyof typeof BADGE_COLORS;

const LOW_ACTIVITY_GROUP: SettingGroup = {name: "깡계", desc: "글댓합이 기준 이하인 유저를 깡계로 봅니다. 글댓비 표시가 켜져 있고 글댓비를 받아 둔 유저만 해당합니다."};

const BADGE_COLOR_GROUP: SettingGroup = {name: "배지 색", desc: "유저 정보 배지의 글자 색입니다. IP는 국가별로 칠하고, VPN이면 국가보다 우선합니다."};

const colorsOf = (ctx: Ctx): Record<string, string> =>
    Object.fromEntries(objectKeys(BADGE_COLORS).map((key) => [key, ctx.settings[`${key}Color`]]));

const IP_INFO_FILTERS: Record<IpInfoFilter, string> = {all: "전체", foreign: "해외·VPN만", vpn: "VPN만", none: "표시 안 함"};

const badgeViewOf = (ctx: Ctx): BadgeView => ({
    order: ctx.settings.badgeOrder,
    fixedUid: ctx.settings.showFixedNickUID,
    halfFixedUid: ctx.settings.showHalfFixedNickUID,
    ipFilter: ctx.settings.ipInfoFilter
});

/** 글댓비 캐시. 다른 탭의 쓰기와 개발자 탭의 캐시 비우기도 watch로 받는다. moduleDataStorage 키라 백업·내보내기에서 빠진다 */
const ratioStorage = moduleDataStorage<{ ratio?: Record<string, RatioInfo> }>("userinfo", {});
let ratios: Record<string, RatioInfo> = {};

/** 글댓비 저장 상한. 최근에 받은 사람부터 이만큼만 남긴다 */
const MAX_RATIOS = 500;

/** 글댓비 캐시는 1시간만 쓴다 */
const isFresh = (info?: RatioInfo): info is RatioInfo => info !== undefined && Date.now() - info.date <= 3600_000;

const buildBadgeSpan = (text: string, color?: string, title?: string, className = "refresherUserData"): HTMLElement => {
    const span = document.createElement("span");
    span.className = className;
    span.textContent = text;
    if (color) span.style.color = color;
    if (title) span.title = title;
    return span;
};

/** 깡계 기준(글댓합) 이하인지. 기준이 0이면 끈 것이다 */
const isLowActivity = (info: RatioInfo, alarmRatio: number): boolean => alarmRatio > 0 && info.article + info.comment <= alarmRatio;

const makeRatioSpan = (info: RatioInfo, alarmRatio: number, colors: Record<string, string>): HTMLElement => {
    const text = `${info.article}/${info.comment}`;
    return buildBadgeSpan(`[${text}]`, isLowActivity(info, alarmRatio) ? colors.ratioAlarm : colors.ratio, text, "ip ratio refresherUserData");
};

const LOW_ACTIVITY_ACTIONS = {none: "배지 색만", tag: "[깡계] 표시", blur: "흐리게", hide: "숨기기"};
const LOW_ACTIVITY_CLASSES = {blur: "refresherLowActivityBlur", hide: "refresherLowActivityHide"} as const;

const clearLowActivity = (): void => {
    const classes = Object.values(LOW_ACTIVITY_CLASSES);
    for (const element of document.querySelectorAll<HTMLElement>(classes.map((name) => `.${name}`).join(","))) element.classList.remove(...classes);
};

const makePermBanSpan = (reasons: string, color: string): HTMLElement =>
    buildBadgeSpan(`[${reasons}]`, color, reasons, "ip permBan refresherUserData");

const process = (ctx: Ctx, element: HTMLElement): void => {
    // 완료 표시 없이 매번 다시 그린다. 파싱 중인 작성자 칸(닉콘·IP 전)에서 먼저 불려도, 칸이 다 읽혀 다시 불릴 때 배지가 제자리를 찾는다
    element.querySelector(".refresher-user-badges")?.remove();

    const colors = colorsOf(ctx);
    const view = badgeViewOf(ctx);
    const gallery = queryString("id");

    const {nick, uid, ip} = element.dataset;
    const badges = document.createElement("span");
    badges.className = "refresher-user-badges";
    let lowActivity = false;

    const appendIdentity = (): void => {
        if (uid) {
            if (showsUid(view, element.querySelector<HTMLImageElement>("img")?.src)) badges.append(buildBadgeSpan(`(${uid})`, colors.uid, uid, "ip refresherUserData"));
            return;
        }

        const info = ip ? ipInfoOf(ip) : undefined;
        if (info && passesIpFilter(info, view.ipFilter)) badges.append(buildBadgeSpan(`[${info.label}]`, colors[info.category], info.title));
    };

    for (const key of view.order) {
        if (key === "UID") appendIdentity();

        if (key === "MEMO") {
            const memo = findMemo({uid, ip, nick}, gallery);
            if (memo) badges.append(buildBadgeSpan(`[${memo.text}]`, memo.color || undefined, memo.text, "refresherUserData refresherMemoData"));
        }

        if (key === "RATIO" && uid && ctx.settings.checkRatio) {
            const cached = ratios[uid];
            if (isFresh(cached)) {
                badges.append(makeRatioSpan(cached, ctx.settings.alarmRatio, colors));
                lowActivity = isLowActivity(cached, ctx.settings.alarmRatio);
            }
        }

        if (key === "PERMBAN" && uid && ctx.settings.checkPermBan) {
            const reasons = banReasonsOf(uid);
            if (reasons) badges.append(makePermBanSpan(reasons, colors.permBan!));
        }
    }

    // 깡계는 글댓비를 받아 둔 유저만 판정한다. 목록 전체를 조회하면 갤로그 요청이 너무 많다
    const action = ctx.settings.lowActivityAction;
    if (lowActivity && action === "tag") badges.append(buildBadgeSpan("[깡계]", colors.ratioAlarm, `글댓합 ${ctx.settings.alarmRatio}개 이하`));
    if (lowActivity && (action === "blur" || action === "hide")) (element.closest<HTMLElement>(".ub-content") ?? element).classList.add(LOW_ACTIVITY_CLASSES[action]);

    if (badges.children.length > 0) insertWriterSpan(element, badges);
};

/** 미리보기 작성자 표시가 같은 색·순서·표시 조건을 쓰도록 ui 스토어에 올린다 */
const publishBadges = (ctx: Ctx): void => {
    const colors = colorsOf(ctx);
    useUiStore.setState({
        badgeColors: {
            ...colors,
            // 갱차 조회를 끄면 미리보기에서도 숨긴다
            permBan: ctx.settings.checkPermBan ? colors.permBan : undefined
        },
        badgeView: badgeViewOf(ctx)
    });
};

/** 미리보기도 같은 글댓비를 쓰도록 ui 스토어에 올린다 */
const publishRatios = (ctx: Ctx): void => {
    useUiStore.setState({
        ratios: ctx.settings.checkRatio
            ? {cache: Object.fromEntries(Object.entries(ratios).filter(([, info]) => isFresh(info))), alarm: ctx.settings.alarmRatio}
            : null
    });
};

const rebuildAll = (ctx: Ctx): void => {
    clearLowActivity();
    // 배지가 없던 작성자도 돈다. 설정을 켜서 새로 생기는 배지가 있다 (필터 선택자와 같은 대상)
    for (const element of document.querySelectorAll<HTMLElement>(".ub-writer:not([user_name])")) process(ctx, element);
};

/** 몇몇 유저의 작성자 칸만 다시 그린다. 깡계 흐림·숨김은 process가 더하기만 하므로 먼저 뗀다 */
const rebuildUsers = (ctx: Ctx, uids: string[]): void => {
    const classes = Object.values(LOW_ACTIVITY_CLASSES);
    for (const uid of uids) {
        for (const element of document.querySelectorAll<HTMLElement>(`.ub-writer[data-uid="${CSS.escape(uid)}"]:not([user_name])`)) {
            (element.closest<HTMLElement>(".ub-content") ?? element).classList.remove(...classes);
            process(ctx, element);
        }
    }
};

const settings = {
    showFixedNickUID: {
        type: "check",
        name: "고정닉 UID 표시",
        desc: "고정닉 유저의 UID를 표시합니다.",
        default: true
    },
    showHalfFixedNickUID: {
        type: "check",
        name: "반고정닉 UID 표시",
        desc: "반고정닉 유저의 UID를 표시합니다.",
        default: true
    },
    ipInfoFilter: {
        type: "option",
        name: "IP 정보 표시",
        desc: "IP의 통신사·조직과 국가를 표시할 대상입니다. VPN은 국가와 상관없이 해외·VPN에 들어갑니다. " +
            "표시되는 정보는 공개 IP 데이터로 추정한 값이라 실제와 다를 수 있습니다.",
        default: "all",
        items: IP_INFO_FILTERS
    },
    checkRatio: {
        type: "check",
        name: "글댓비 표시",
        desc: "글댓비를 표시합니다. (1시간마다 갱신, 새 글 작성 시에만 조회)",
        default: false
    },
    alarmRatio: {
        type: "range",
        group: LOW_ACTIVITY_GROUP,
        name: "기준",
        desc: "글댓합이 이 값 이하면 깡계로 봅니다. (0이면 끔)",
        default: 0,
        min: 0,
        max: 5000,
        step: 10,
        unit: "개"
    },
    lowActivityAction: {
        type: "option",
        group: LOW_ACTIVITY_GROUP,
        name: "처리",
        desc: "깡계 유저의 글·댓글을 어떻게 보여 줄지 정합니다.",
        default: "tag",
        items: LOW_ACTIVITY_ACTIONS
    },
    checkPermBan: {
        type: "check",
        name: "갱차 조회",
        desc: "갱신 차단 여부를 조회합니다.",
        default: false
    },
    ...(Object.fromEntries(
        Object.entries(BADGE_COLORS).map(([key, [name, color]]) => [
            `${key}Color`,
            {type: "color", group: BADGE_COLOR_GROUP, name, desc: `${name} 배지의 글자 색입니다.`, default: color}
        ])
    ) as Record<`${BadgeColor}Color`, Extract<SettingSchema, { type: "color" }>>),
    badgeOrder: {
        type: "order",
        name: "정보 배치 순서",
        desc: "유저 정보 배지의 표시 순서를 정합니다.",
        items: {UID: "유저 ID / IP", MEMO: "메모", RATIO: "글댓비", PERMBAN: "갱차"},
        default: ["UID", "MEMO", "RATIO", "PERMBAN"]
    }
} satisfies SettingsSchema;

type Ctx = ModuleContext<typeof settings>;

export default defineModule({
    id: "userinfo",
    name: "유저 정보",
    description: "사용자의 IP, 아이디 정보, 메모를 표시합니다.",
    icon: UserRound,
    urls: [BOARD_PAGE],

    settings,

    async setup(ctx) {
        // await 전에 알린다. 뒤에 두면 기다리는 동안 모듈이 꺼졌을 때 revoke가 지운 값을 다시 쓴다
        publishBadges(ctx);

        // await 뒤마다 확인해, 그사이 모듈이 꺼졌으면 revoke가 지운 배지·글댓비를 다시 그리지 않는다
        const {signal} = ctx;

        // IP/밴 DB는 모듈 설정을 읽은 뒤 여기서 처음 읽는다 (콘텐츠 스크립트도 부르지만 이 모듈이 꺼졌을 때를 위한 것이다).
        // 읽기가 끝난 뒤 필터를 걸어야 첫 배지부터 IP 정보가 붙는다
        const [stored] = await Promise.all([ratioStorage.getValue(), initDatabase()]);
        ratios = stored.ratio ?? {};
        if (signal.aborted) return;
        publishRatios(ctx);
        // 이 탭과 다른 탭이 받아 쓴 글댓비가 모두 여기로 온다. 열린 디시 탭마다 오므로, 값이 바뀐 유저의 칸만 다시 그린다
        const unwatchRatios = ratioStorage.watch((next, previous) => {
            const before = previous?.ratio ?? {};
            ratios = next?.ratio ?? {};
            const changed = [...new Set([...Object.keys(before), ...Object.keys(ratios)])]
                .filter((uid) => JSON.stringify(before[uid]) !== JSON.stringify(ratios[uid]));
            if (changed.length === 0) return;

            publishRatios(ctx);
            rebuildUsers(ctx, changed);
        });

        ctx.addFilter(
            ".ub-writer:not([user_name])",
            (element) => process(ctx, element)
        );

        const unsubscribeMemos = useMemosStore.subscribe((state, previous) => {
            if (state.memos !== previous.memos) rebuildAll(ctx);
        });

        // IP DB가 갱신되거나 갱차 목록을 다 읽으면 다시 그린다. 갱차 목록은 banReasonsOf를 처음 부를 때 읽기 시작한다
        const unwatchDatabase = subscribeDatabase(() => rebuildAll(ctx));

        // 새 글 작성자의 글댓비를 조회한다 (1시간 캐시, 앞 10개만)
        eventBus.on("newPostList", ({data: elements}) => {
            if (!ctx.settings.checkRatio) return;

            const stale: string[] = [];

            for (const post of elements.slice(0, 10)) {
                const writer = post.querySelector<HTMLElement>(".ub-writer");
                const uid = writer?.dataset.uid;
                if (!uid) continue;

                if (!isFresh(ratios[uid]) && !stale.includes(uid)) {
                    stale.push(uid);
                }
            }

            if (stale.length === 0) return;

            // 실패는 uid마다 흡수한다. 한 명이 실패해도 받아 온 나머지는 저장한다 (실패한 사람은 배지만 빠진다)
            void Promise.all(stale.map(async (uid) => [uid, await fetchGallogActivity(uid).catch(() => undefined)] as const)).then(async (results) => {
                const fresh = results.filter((entry): entry is [string, GallogActivity] => Boolean(entry[1]));
                if (fresh.length === 0) return;

                // 그사이 다른 탭이 쓴 값을 잃지 않게 저장소의 최신 값에 병합한다.
                // 만료 항목은 여기서 버리고(안 그러면 계속 쌓인다), 최근에 받은 MAX_RATIOS명만 남긴다
                const now = Date.now();
                const stored = (await ratioStorage.getValue()).ratio ?? {};
                if (signal.aborted) return;

                const merged: [string, RatioInfo][] = [
                    ...Object.entries(stored).filter(([uid, info]) => isFresh(info) && !fresh.some(([freshUid]) => freshUid === uid)),
                    ...fresh.map(([uid, info]): [string, RatioInfo] => [uid, {...info, date: now}])
                ];
                ratios = Object.fromEntries(merged.sort(([, a], [, b]) => b.date - a.date).slice(0, MAX_RATIOS));
                // 다시 그리기는 위의 ratioStorage.watch가 한다
                await ratioStorage.setValue({ratio: ratios});
            }).catch(console.error);
        }, {signal});

        ctx.addCleanup(() => {
            unwatchRatios();
            unsubscribeMemos();
            unwatchDatabase();
        });
    },

    onChanged(ctx) {
        publishBadges(ctx);
        publishRatios(ctx);
        rebuildAll(ctx);
    },

    revoke() {
        useUiStore.setState({badgeColors: {}, badgeView: DEFAULT_BADGE_VIEW, ratios: null});
        clearLowActivity();

        for (const element of document.querySelectorAll<HTMLElement>(".refresher-user-badges")) {
            element.remove();
        }
    }
});
