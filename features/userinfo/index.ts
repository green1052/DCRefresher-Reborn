import {banReasonsOf, ipInfoOf} from "@/core/database";
import {defineModule} from "@/core/module/define";
import type {ModuleContext, SettingGroup} from "@/core/module/types";
import {fetchGallogActivity, type GallogActivity} from "@/core/gallog";
import {queryString} from "@/core/http/urls";
import {eventBus} from "@/core/eventbus/bus";
import type {JsonValue} from "@/core/storage/types";
import {dbStorage, moduleDataStorage} from "@/core/storage/items";
import {findMemo, useMemosStore} from "@/stores/memos";
import {useUiStore} from "@/stores/ui";
import {getType} from "@/utils/user";
import {insertWriterSpan} from "@/utils/userDataInsert";

type BadgeKey = "UID" | "MEMO" | "RATIO" | "PERMBAN";

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

const BADGE_COLOR_GROUP: SettingGroup = {name: "배지 색", desc: "유저 정보 배지의 글자 색입니다. IP는 국가별로 칠하고, VPN이면 국가보다 우선합니다."};

const colorsOf = (ctx: ModuleContext): Record<string, string> =>
    Object.fromEntries(Object.keys(BADGE_COLORS).map((key) => [key, String(ctx.settings[`${key}Color`])]));

const asRatios = (value: JsonValue | undefined): Record<string, RatioInfo> => (value ?? {}) as unknown as Record<string, RatioInfo>;

/** 글댓비 캐시 ({ratio: {uid: RatioInfo}}) — 다른 탭의 쓰기·개발자 탭의 캐시 비우기를 watch로 받는다 */
const ratioStorage = moduleDataStorage("userinfo");
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

const makeRatioSpan = (info: RatioInfo, alarmRatio: number, colors: Record<string, string>): HTMLElement => {
    const text = `${info.article}/${info.comment}`;
    const alarm = alarmRatio > 0 && info.article + info.comment <= alarmRatio;
    return buildBadgeSpan(`[${text}]`, alarm ? colors.ratioAlarm : colors.ratio, text, "ip ratio refresherUserData");
};

const makePermBanSpan = (reasons: string, color: string): HTMLElement =>
    buildBadgeSpan(`[${reasons}]`, color, reasons, "ip permBan refresherUserData");

const process = (ctx: ModuleContext, element: HTMLElement): void => {
    if (element.dataset.refresherUserInfo === "1") return;

    // 작성자마다 불리고 rebuildAll로 페이지 전체가 다시 도므로 호출 안에서 안 바뀌는 값은 한 번만 만든다
    const colors = colorsOf(ctx);
    const gallery = queryString("id");

    const {nick, uid, ip} = element.dataset;
    const badges = document.createElement("span");
    badges.className = "refresher-user-badges";

    const appendIdentity = (): void => {
        if (uid) {
            const image = element.querySelector<HTMLImageElement>("img")?.src;

            const type = image ? getType(image) : "NONE";
            const isFixed = type.startsWith("FIXED");
            const isHalfFixed = type.startsWith("HALF_FIXED");

            const show = isFixed ? ctx.settings.showFixedNickUID === true : isHalfFixed ? ctx.settings.showHalfFixedNickUID === true : true;

            if (show) badges.append(buildBadgeSpan(`(${uid})`, colors.uid, uid, "ip refresherUserData"));
            return;
        }

        if (ip && ctx.settings.showIpInfo === true) {
            const info = ipInfoOf(ip);
            if (info) badges.append(buildBadgeSpan(`[${info.label}]`, colors[info.category], info.title));
        }
    };

    for (const key of ctx.settings.badgeOrder as BadgeKey[]) {
        if (key === "UID") appendIdentity();

        if (key === "MEMO") {
            const memo = findMemo({uid, ip, nick}, gallery);
            if (memo) badges.append(buildBadgeSpan(`[${memo.text}]`, memo.color || undefined, memo.text, "refresherUserData refresherMemoData"));
        }

        if (key === "RATIO" && uid && ctx.settings.checkRatio === true) {
            const cached = ratios[uid];
            if (isFresh(cached)) {
                badges.append(makeRatioSpan(cached, Number(ctx.settings.alarmRatio), colors));
            }
        }

        if (key === "PERMBAN" && uid && ctx.settings.checkPermBan === true) {
            const reasons = banReasonsOf(uid);
            if (reasons) badges.append(makePermBanSpan(reasons, colors.permBan!));
        }
    }

    if (badges.children.length === 0) return;

    element.dataset.refresherUserInfo = "1";
    insertWriterSpan(element, badges);
};

/** 미리보기 댓글도 같은 색을 쓰게 공유 */
const publishBadgeColors = (ctx: ModuleContext): void => {
    const colors = colorsOf(ctx);
    useUiStore.setState({
        badgeColors: {
            ...colors,
            // 갱차 조회를 끄면 미리보기에서도 숨긴다
            permBan: ctx.settings.checkPermBan === true ? colors.permBan : undefined
        }
    });
};

const rebuildAll = (ctx: ModuleContext): void => {
    // 배지가 없던 작성자도 포함 — 설정을 켜서 새로 생기는 배지가 있다 (필터 선택자와 같은 대상)
    for (const element of document.querySelectorAll<HTMLElement>(".ub-writer:not([user_name])")) {
        delete element.dataset.refresherUserInfo;
        element.querySelector(".refresher-user-badges")?.remove();
        process(ctx, element);
    }
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
        showIpInfo: {
            type: "check",
            name: "IP 정보 표시",
            desc: "IP의 통신사·조직과 국가를 표시합니다.",
            default: true
        },
        checkRatio: {
            type: "check",
            name: "글댓비 표시",
            desc: "글댓비를 표시합니다. (1시간마다 갱신, 새 글 작성 시에만 조회)",
            default: false
        },
        alarmRatio: {
            type: "range",
            name: "깡계 알림",
            desc: "글댓합이 설정한 값 이하일 때 강조 표시합니다. (0이면 비활성화)",
            default: 0,
            min: 0,
            max: 5000,
            step: 10,
            unit: "개"
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
        publishBadgeColors(ctx);

        ratios = asRatios((await ratioStorage.getValue())?.ratio);
        const unwatchRatios = ratioStorage.watch((next) => {
            ratios = asRatios(next?.ratio);
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
        const offNewPostList = eventBus.on("newPostList", ({data: elements}) => {
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
                const stored = asRatios((await ratioStorage.getValue())?.ratio);
                ratios = Object.fromEntries([
                    ...Object.entries(stored).filter(([, info]) => isFresh(info)),
                    ...fresh.map(([uid, info]) => [uid, {...info, date: now}])
                ]);
                await ratioStorage.setValue({ratio: ratios as unknown as JsonValue});

                rebuildAll(ctx);
            });
        });

        ctx.addCleanup(() => {
            unwatchRatios();
            unsubscribeMemos();
            unwatchDatabase();
            offNewPostList();
        });
    },

    onChanged(ctx) {
        // 설정(순서/표시여부) 변경시 즉시 재계산. 배지 색은 설정에만 달렸으니 여기서만 다시 알린다
        publishBadgeColors(ctx);
        rebuildAll(ctx);
    },

    revoke() {
        useUiStore.setState({badgeColors: {}});

        for (const element of document.querySelectorAll<HTMLElement>(".ub-writer[data-refresher-user-info]")) {
            delete element.dataset.refresherUserInfo;
        }

        for (const element of document.querySelectorAll<HTMLElement>(".refresher-user-badges")) {
            element.remove();
        }
    }
});
