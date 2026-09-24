import * as memoCore from "@/core/memo";
import type {ModuleContext, ModuleDefinition} from "@/core/module/types";
import {memoStorage, MEMO_TYPES} from "@/core/storage/items";
import type {MemoEntry, MemoType} from "@/core/storage/types";
import {ISPData, format as formatIP} from "@/utils/ip";
import {getType} from "@/utils/user";
import {insertWriterSpan} from "@/utils/userDataInsert";

type BadgeKey = "UID" | "IP" | "MEMO";

let currentCtx: ModuleContext | null = null;

const buildBadgeSpan = (text: string, color?: string, title?: string, className = "refresherUserData"): HTMLElement => {
    const span = document.createElement("span");
    span.className = className;
    span.textContent = text;
    if (color) span.style.color = color;
    if (title) span.title = title;
    return span;
};

const process = (ctx: ModuleContext, element: HTMLElement): void => {
    if (element.dataset.refresherUserInfo === "1") return;

    const {nick, uid, ip} = element.dataset;
    const badges = document.createElement("span");
    badges.className = "refresher-user-badges";

    // 설정 순서대로 배지 생성 (order에 없는 키는 스키마에 없음)
    for (const key of ctx.settings.badgeOrder as BadgeKey[]) {
        if (key === "UID" && uid) {
            // v5: .ub-writer의 첫 번째 이미지 = 닉콘
            const image = element.querySelector<HTMLImageElement>("img")?.src;

            if (image) {
                const type = getType(image);
                const isFixed = type.startsWith("FIXED");
                const isHalfFixed = type.startsWith("HALF_FIXED");

                // 유동닉은 항상 표시 (v5: 고정/반고정만 설정으로 숨김)
                const show = isFixed ? ctx.settings.showFixedNickUID === true : isHalfFixed ? ctx.settings.showHalfFixedNickUID === true : true;

                if (show) badges.append(buildBadgeSpan(`(${uid})`, undefined, uid, "ip refresherUserData"));
            }
        }

        if (key === "IP" && ip && ctx.settings.showIpInfo === true) {
            const ipData = ISPData(ip);
            const formatted = formatIP(ipData);
            if (formatted) badges.append(buildBadgeSpan(`[${formatted}]`, ipData.color, formatted));
        }

        if (key === "MEMO") {
            const memo: MemoEntry | undefined =
                (uid && memoCore.get("UID", uid)) || (ip && memoCore.get("IP", ip)) || (nick && memoCore.get("NICK", nick)) || undefined;

            if (memo) badges.append(buildBadgeSpan(`[${memo.text}]`, memo.color || undefined, memo.text, "refresherUserData refresherMemoData"));
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
        badgeOrder: {
            type: "order",
            name: "정보 배지 순서",
            desc: "유저 정보 배지의 표시 순서를 정합니다.",
            items: {UID: "유저 ID", IP: "IP 정보", MEMO: "메모"},
            default: ["UID", "IP", "MEMO"]
        }
    },

    setup(ctx) {
        currentCtx = ctx;

        ctx.addFilter(
            ".ub-writer:not([user_name])",
            (element) => process(ctx, element),
            {neverExpire: true}
        );

        // 메모 변경시 표시 갱신 (v5는 마지막 선택 대상만, v6은 간단히 전체 재계산)
        const watchers = MEMO_TYPES.map((type: MemoType) => memoStorage[type].watch(() => rebuildAll(ctx)));
        ctx.addCleanup(() => {
            watchers.forEach((watch) => watch());
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
