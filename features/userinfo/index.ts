import {storage} from "wxt/utils/storage";

import {banReasonsOf, ipInfoOf, type IpInfoFilter, passesIpFilter} from "@/core/database";
import {defineModule} from "@/core/module/define";
import type {ModuleContext, SettingGroup} from "@/core/module/types";
import {fetchGallogActivity, type GallogActivity} from "@/core/gallog";
import {queryString} from "@/core/http/urls";
import {eventBus} from "@/core/eventbus/bus";
import {dbStorage, moduleSettingsStorage} from "@/core/storage/items";
import {findMemo, useMemosStore} from "@/stores/memos";
import {type BadgeView, DEFAULT_BADGE_VIEW, showsUid, useUiStore} from "@/stores/ui";
import {insertWriterSpan} from "@/utils/userDataInsert";

interface RatioInfo {
    article: number;
    comment: number;
    date: number;
}

/** 배지 색 — 키마다 `${키}Color` 설정 하나 (옵션 화면에선 한 칸에 묶임). IP는 분류(korea…vpn)가 키 */
const BADGE_COLORS: Record<string, [name: string, color: string]> = {
    uid: ["유저 ID / IP", "#999999"],
    ratio: ["글댓비", "#999999"],
    ratioAlarm: ["글댓비 경고", "#ff0000"],
    permBan: ["갱차", "#e8645f"],
    korea: ["IP 한국", "#6495ed"],
    japan: ["IP 일본", "#e5484d"],
    china: ["IP 중국", "#f76b15"],
    foreign: ["IP 그 외 해외", "#12a594"],
    vpn: ["IP VPN", "#8e4ec6"]
};

const LOW_ACTIVITY_GROUP: SettingGroup = {name: "깡계", desc: "글댓합이 기준 이하인 유저를 깡계로 봅니다. 글댓비 표시가 켜져 있고 글댓비를 받아 둔 유저만 해당합니다."};

const BADGE_COLOR_GROUP: SettingGroup = {name: "배지 색", desc: "유저 정보 배지의 글자 색입니다. IP는 국가별로 칠하고, VPN이면 국가보다 우선합니다."};

const colorsOf = (ctx: ModuleContext): Record<string, string> =>
    Object.fromEntries(Object.keys(BADGE_COLORS).map((key) => [key, String(ctx.settings[`${key}Color`])]));

const IP_INFO_FILTERS: Record<IpInfoFilter, string> = {all: "전체", foreign: "해외·VPN만", vpn: "VPN만", none: "표시 안 함"};

const badgeViewOf = (ctx: ModuleContext): BadgeView => ({
    order: ctx.settings.badgeOrder as BadgeView["order"],
    fixedUid: ctx.settings.showFixedNickUID === true,
    halfFixedUid: ctx.settings.showHalfFixedNickUID === true,
    ipFilter: ctx.settings.ipInfoFilter as IpInfoFilter
});

/** 글댓비 캐시 — 다른 탭의 쓰기·개발자 탭의 캐시 비우기를 watch로 받는다. 키는 백업 제외 규칙(refresher:module:*:data)을 따른다 */
const ratioStorage = storage.defineItem<{ ratio?: Record<string, RatioInfo> }>("local:refresher:module:userinfo:data", {fallback: {}});
let ratios: Record<string, RatioInfo> = {};

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

/** 깡계 알림 기준(글댓합) 이하인지 — 0이면 끔 */
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

const process = (ctx: ModuleContext, element: HTMLElement): void => {
    // 완료 표시 없이 매번 다시 그린다 — 파싱 중인 작성자 칸(닉콘·IP 전)에 붙은 배지가 칸이 다 읽혀 다시 불릴 때 제자리를 찾는다
    element.querySelector(".refresher-user-badges")?.remove();

    // 작성자마다 불리고 rebuildAll로 페이지 전체가 다시 도므로 호출 안에서 안 바뀌는 값은 한 번만 만든다
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

        if (key === "RATIO" && uid && ctx.settings.checkRatio === true) {
            const cached = ratios[uid];
            if (isFresh(cached)) {
                badges.append(makeRatioSpan(cached, Number(ctx.settings.alarmRatio), colors));
                lowActivity = isLowActivity(cached, Number(ctx.settings.alarmRatio));
            }
        }

        if (key === "PERMBAN" && uid && ctx.settings.checkPermBan === true) {
            const reasons = banReasonsOf(uid);
            if (reasons) badges.append(makePermBanSpan(reasons, colors.permBan!));
        }
    }

    // 깡계: 글댓비를 받아 둔 유저만 — 목록 전체를 조회하면 갤로그 요청이 너무 많다
    const action = ctx.settings.lowActivityAction;
    if (lowActivity && action === "tag") badges.append(buildBadgeSpan("[깡계]", colors.ratioAlarm, `글댓합 ${ctx.settings.alarmRatio}개 이하`));
    if (lowActivity && (action === "blur" || action === "hide")) (element.closest<HTMLElement>(".ub-content") ?? element).classList.add(LOW_ACTIVITY_CLASSES[action]);

    if (badges.children.length > 0) insertWriterSpan(element, badges);
};

/** 미리보기 작성자 표시도 같은 색·순서·표시 조건을 쓰게 공유 */
const publishBadges = (ctx: ModuleContext): void => {
    const colors = colorsOf(ctx);
    useUiStore.setState({
        badgeColors: {
            ...colors,
            // 갱차 조회를 끄면 미리보기에서도 숨긴다
            permBan: ctx.settings.checkPermBan === true ? colors.permBan : undefined
        },
        badgeView: badgeViewOf(ctx)
    });
};

/** 예전 'IP 정보 표시' 체크(showIpInfo)를 끈 사용자는 '표시 안 함'으로 옮긴다 — 새 설정을 한 번이라도 저장했으면 건드리지 않는다 */
const migrateShowIpInfo = async (): Promise<void> => {
    const item = moduleSettingsStorage("userinfo");
    const stored = await item.getValue();
    if (stored.showIpInfo === false && stored.ipInfoFilter === undefined) await item.setValue({...stored, ipInfoFilter: "none"});
};

/** 미리보기도 같은 글댓비를 쓰게 공유 */
const publishRatios = (ctx: ModuleContext): void => {
    useUiStore.setState({
        ratios: ctx.settings.checkRatio === true
            ? {cache: Object.fromEntries(Object.entries(ratios).filter(([, info]) => isFresh(info))), alarm: Number(ctx.settings.alarmRatio)}
            : null
    });
};

const rebuildAll = (ctx: ModuleContext): void => {
    clearLowActivity();
    // 배지가 없던 작성자도 포함 — 설정을 켜서 새로 생기는 배지가 있다 (필터 선택자와 같은 대상)
    for (const element of document.querySelectorAll<HTMLElement>(".ub-writer:not([user_name])")) process(ctx, element);
};

export default defineModule({
    id: "userinfo",
    name: "유저 정보",
    description: "사용자의 IP, 아이디 정보, 메모를 표시합니다.",
    urls: [/\/board\/(view|lists)/],
    defaultEnable: true,

    settings: {
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
            desc: "IP의 통신사·조직과 국가를 표시할 대상입니다. VPN은 국가와 상관없이 해외·VPN에 들어갑니다.",
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
        ...Object.fromEntries(
            Object.entries(BADGE_COLORS).map(([key, [name, color]]) => [
                `${key}Color`,
                {type: "color", group: BADGE_COLOR_GROUP, name, desc: `${name} 배지의 글자 색입니다.`, default: color} as const
            ])
        ),
        badgeOrder: {
            type: "order",
            name: "정보 배치 순서",
            desc: "유저 정보 배지의 표시 순서를 정합니다.",
            items: {UID: "유저 ID / IP", MEMO: "메모", RATIO: "글댓비", PERMBAN: "갱차"},
            default: ["UID", "MEMO", "RATIO", "PERMBAN"]
        }
    },

    async setup(ctx) {
        // 먼저 그린다 — 옮기는 동안 모듈이 꺼지면 revoke가 지운 뒤에 다시 그리게 된다. 옮긴 값은 설정 감시 → onChanged가 반영한다
        publishBadges(ctx);
        await migrateShowIpInfo().catch(console.error);

        // 조회 중에 모듈이 꺼지면 revoke가 지운 배지·글댓비를 다시 그리지 않게 한다 (setup을 기다리는 동안 꺼져도 마찬가지)
        const {signal} = ctx;

        ratios = (await ratioStorage.getValue()).ratio ?? {};
        if (signal.aborted) return;
        publishRatios(ctx);
        // 이 탭이 받아 쓴 값도, 다른 탭이 받은 값도 여기로 온다 — 배지와 깡계 표시를 다시 그린다
        const unwatchRatios = ratioStorage.watch((next) => {
            ratios = next?.ratio ?? {};
            publishRatios(ctx);
            rebuildAll(ctx);
        });

        ctx.addFilter(
            ".ub-writer:not([user_name])",
            (element) => process(ctx, element)
        );

        // 메모 변경시 표시 갱신
        const unsubscribeMemos = useMemosStore.subscribe((state, previous) => {
            if (state.memos !== previous.memos) rebuildAll(ctx);
        });

        // IP/갱차 DB가 갱신되면 다시 그린다 (core/database의 감시가 먼저 등록돼 새 데이터가 이미 로드된 뒤다)
        const unwatchDatabase = dbStorage.watch(() => rebuildAll(ctx));

        // 새 글: 글댓비 조회 (1시간 캐시, 첫 10개)
        eventBus.on("newPostList", ({data: elements}) => {
            if (ctx.settings.checkRatio !== true) return;

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

            // 실패는 uid마다 흡수 — 한 명이 실패했다고 받아 온 나머지까지 버리지 않는다 (실패는 배지만 못 보여줄 뿐)
            void Promise.all(stale.map(async (uid) => [uid, await fetchGallogActivity(uid).catch(() => undefined)] as const)).then(async (results) => {
                const fresh = results.filter((entry): entry is [string, GallogActivity] => Boolean(entry[1]));
                if (fresh.length === 0) return;

                // 저장소의 최신 값에 병합 (다른 탭이 그사이 쓴 것 유지). 만료 항목은 여기서 버린다 — 안 그러면 uid마다 계속 쌓인다
                const now = Date.now();
                const stored = (await ratioStorage.getValue()).ratio ?? {};
                if (signal.aborted) return;

                ratios = Object.fromEntries([
                    ...Object.entries(stored).filter(([, info]) => isFresh(info)),
                    ...fresh.map(([uid, info]) => [uid, {...info, date: now}])
                ]);
                // 다시 그리기는 위 watch가 한다
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
        // 설정(순서/표시여부) 변경시 즉시 재계산. 배지 색은 설정에만 달렸으니 여기서만 다시 알린다
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
