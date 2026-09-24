import * as memoCore from "@/core/memo";
import type {ModuleContext, ModuleDefinition} from "@/core/module/types";
import {http} from "@/core/http/client";
import {eventBus} from "@/core/eventbus/bus";
import {MEMO_TYPES, memoStorage} from "@/core/storage/items";
import type {JsonValue, MemoEntry, MemoType} from "@/core/storage/types";
import {format as formatIP, ISPData} from "@/utils/ip";
import {getBan} from "@/utils/ban";
import {getType} from "@/utils/user";
import {insertWriterSpan} from "@/utils/userDataInsert";

type BadgeKey = "UID" | "MEMO" | "RATIO" | "PERMBAN";

interface RatioInfo {
    article: number;
    comment: number;
    date: number;
}

const GALLOG_API = "https://gall.dcinside.com/api/gallog_user_layer/gallog_content_reple";

const asRatios = (value: JsonValue | undefined): Record<string, RatioInfo> => (value ?? {}) as unknown as Record<string, RatioInfo>;

let currentCtx: ModuleContext | null = null;

const buildBadgeSpan = (text: string, color?: string, title?: string, className = "refresherUserData"): HTMLElement => {
    const span = document.createElement("span");
    span.className = className;
    span.textContent = text;
    if (color) span.style.color = color;
    if (title) span.title = title;
    return span;
};

const makeRatioSpan = (info: RatioInfo, alarmRatio: number): HTMLElement => {
    const span = buildBadgeSpan(`[${info.article}/${info.comment}]`, undefined, undefined, "ip ratio refresherUserData");
    span.title = `${info.article}/${info.comment}`;
    if (alarmRatio > 0 && info.article + info.comment <= alarmRatio) span.style.color = "red";
    return span;
};

const makePermBanSpan = (reasons: string): HTMLElement => {
    const span = buildBadgeSpan(`[${reasons}]`, "#e8645f", reasons, "ip permBan refresherUserData");
    return span;
};

const fetchRatio = async (uid: string): Promise<RatioInfo | undefined> => {
    const text = await http.post(GALLOG_API, {
        headers: {"X-Requested-With": "XMLHttpRequest"},
        body: new URLSearchParams({ci_t: (await cookieStore.get("ci_c"))?.value ?? "", user_id: uid})
    }).text();

    const [article, comment] = text.split(",").map(Number);
    if (Number.isNaN(article) || Number.isNaN(comment) || article === undefined || comment === undefined) return undefined;

    return {article, comment, date: Date.now()};
};

const process = (ctx: ModuleContext, element: HTMLElement): void => {
    if (element.dataset.refresherUserInfo === "1") return;

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

            if (show) badges.append(buildBadgeSpan(`(${uid})`, undefined, uid, "ip refresherUserData"));
            return;
        }

        if (ip && ctx.settings.showIpInfo === true) {
            const ipData = ISPData(ip);
            const formatted = formatIP(ipData);
            if (formatted) badges.append(buildBadgeSpan(`[${formatted}]`, ipData.color, formatted));
        }
    };

    for (const key of ctx.settings.badgeOrder as BadgeKey[]) {
        if (key === "UID") appendIdentity();

        if (key === "MEMO") {
            const memo: MemoEntry | undefined =
                (uid && memoCore.get("UID", uid)) || (ip && memoCore.get("IP", ip)) || (nick && memoCore.get("NICK", nick)) || undefined;

            if (memo) badges.append(buildBadgeSpan(`[${memo.text}]`, memo.color || undefined, memo.text, "refresherUserData refresherMemoData"));
        }

        if (key === "RATIO" && uid && ctx.settings.checkRatio === true) {
            const cached = asRatios(ctx.data.ratio)[uid];
            if (cached && Date.now() - cached.date <= 3600_000) {
                badges.append(makeRatioSpan(cached, Number(ctx.settings.alarmRatio)));
            }
        }

        if (key === "PERMBAN" && uid && ctx.settings.checkPermBan === true) {
            const reasons = getBan(uid);
            if (reasons) badges.append(makePermBanSpan(reasons));
        }
    }

    if (badges.children.length === 0) return;

    element.dataset.refresherUserInfo = "1";
    insertWriterSpan(element, badges, "after-icon");
};

const rebuildAll = (ctx: ModuleContext): void => {
    for (const element of document.querySelectorAll<HTMLElement>(".ub-writer[data-refresher-user-info]")) {
        delete element.dataset.refresherUserInfo;
        element.querySelector(".refresher-user-badges")?.remove();
        process(ctx, element);
    }
};

const userinfoModule: ModuleDefinition = {
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
            desc: "IP 정보를 표시합니다.",
            default: true
        },
        checkRatio: {
            type: "check",
            name: "글댓비 표시",
            desc: "글댓비를 표시합니다. (1시간 마다 갱신, 새 글 작성시에만 조회)",
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
        badgeOrder: {
            type: "order",
            name: "정보 배치 순서",
            desc: "유저 정보 배지의 표시 순서를 정합니다.",
            items: {UID: "유저 ID / IP", MEMO: "메모", RATIO: "글댓비", PERMBAN: "갱차"},
            default: ["UID", "MEMO", "RATIO", "PERMBAN"]
        }
    },

    setup(ctx) {
        currentCtx = ctx;

        ctx.addFilter(
            ".ub-writer:not([user_name])",
            (element) => process(ctx, element),
            {neverExpire: true}
        );

        // 메모 변경시 표시 갱신
        const watchers = MEMO_TYPES.map((type: MemoType) => memoStorage[type].watch(() => rebuildAll(ctx)));

        // 새 글: 글댓비 조회 (1시간 캐시, 첫 10개)
        const offNewPostList = eventBus.on("newPostList", ({data: elements}) => {
            if (ctx.settings.checkRatio !== true) return;

            const ratios = asRatios(ctx.data.ratio);
            const stale: string[] = [];

            for (const post of elements.slice(0, 10)) {
                const writer = post.querySelector<HTMLElement>(".ub-writer");
                const uid = writer?.dataset.uid;
                if (!uid) continue;

                const cached = ratios[uid];
                if (!(cached && Date.now() - cached.date <= 3600_000) && !stale.includes(uid)) {
                    stale.push(uid);
                }
            }

            if (stale.length === 0) return;

            void Promise.all(stale.map(async (uid) => [uid, await fetchRatio(uid)] as const)).then((results) => {
                const fresh = results.filter((entry): entry is [string, RatioInfo] => Boolean(entry[1]));
                if (fresh.length === 0) return;

                // 1회 대입 (Proxy → 스토리지 증분 쓰기 방지)
                ctx.data.ratio = {
                    ...(ratios as Record<string, RatioInfo>),
                    ...Object.fromEntries(fresh.map(([uid, info]) => [uid, {...info, date: Date.now()}]))
                } as JsonValue;

                rebuildAll(ctx);
            });
        });

        ctx.addCleanup(() => {
            watchers.forEach((watch) => watch());
            offNewPostList();
            if (currentCtx === ctx) currentCtx = null;
        });
    },

    onChanged() {
        // 설정(순서/표시여부) 변경시 즉시 재계산
        if (currentCtx) rebuildAll(currentCtx);
    },

    revoke() {
        for (const element of document.querySelectorAll<HTMLElement>(".ub-writer[data-refresher-user-info]")) {
            delete element.dataset.refresherUserInfo;
        }

        for (const element of document.querySelectorAll<HTMLElement>(".refresher-user-badges")) {
            element.remove();
        }
    }
};

export default userinfoModule;
