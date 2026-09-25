import {isAnyBlocked, isBlocked} from "@/core/block";
import {defineModule} from "@/core/module/define";
import type {ModuleContext} from "@/core/module/types";
import {queryString} from "@/core/http/urls";
import {useBlocksStore} from "@/stores/blocks";
import {useUiStore} from "@/stores/ui";
import {eventTarget} from "@/utils/event";

import {handleBlockRequest} from "./request";

/** 디시콘 이미지 URL에서 디시콘 코드(no 파라미터) 추출 */
const extractDcconCode = (src: string): string => src.replace(/^.*no=/, "").replace(/&.*$/, "");

/**
 * 디시콘 요소의 코드. 필터와 우클릭 선택이 같은 기준을 써야 선택해서 넣은 항목이 실제로 가려진다
 * (src 없이 data-src나 <source>만 가진 video 디시콘도 있고, 빈 src 속성도 넘겨야 해서 ||)
 */
const dcconCode = (element: HTMLElement): string | undefined => {
    const media = (element as HTMLImageElement).src ? element : (element.querySelector("img, video, source") ?? element);
    const src = media.getAttribute("src") || media.getAttribute("data-src");
    return src ? extractDcconCode(src) : undefined;
};

const isViewPage = (): boolean => location.href.includes("/board/view");

const setupFilters = (ctx: ModuleContext, gallery: string | undefined): void => {
    const useBlur = () => ctx.settings.blur === true;

    const hide = (element: HTMLElement, blur: boolean): void => {
        if (blur) {
            element.classList.add("refresherBlur");
            return;
        }

        element.classList.add("refresherBlocked");
        element.style.display = "none";
    };

    const hideWithReply = (target: HTMLElement): void => {
        hide(target, useBlur());

        if (!ctx.settings.replyRemove) return;

        const next = target.nextElementSibling;
        if (next instanceof HTMLElement && !next.classList.contains("ub-content") && next.querySelector(":scope > .reply")) {
            hide(next, useBlur());
        }
    };

    // 유저/제목/말머리/댓글 차단
    const checkWriter = (element: HTMLElement): void => {
        // 제목/말머리는 작성자 칸이 아니라 같은 행(.ub-content)의 다른 칸에 있음
        const row = element.closest<HTMLElement>(".ub-content");
        const title = row?.querySelector(".gall_tit > a:not([class])")?.textContent?.trim();
        const tab = row?.querySelector(".gall_subject")?.textContent?.trim();
        const commentContainer = isViewPage() ? element.closest(".reply_info, .cmt_info") : null;
        const comment = commentContainer?.querySelector(".usertxt")?.textContent;
        const {nick, uid, ip} = element.dataset;

        const blocked = isAnyBlocked(
            {
                TITLE: title || null,
                NICK: nick || null,
                ID: uid || null,
                IP: ip || null,
                TAB: tab || null,
                COMMENT: comment || null
            },
            gallery
        );

        if (blocked) hideWithReply(row ?? element);
    };

    // 디시콘 차단
    const checkDccon = (element: HTMLElement): void => {
        const code = dcconCode(element);
        if (!code || !isBlocked("DCCON", code, gallery)) return;

        const target = (element.closest<HTMLElement>(".ub-content")) ?? (element.closest<HTMLElement>(".comment_dccon"));
        if (target) hideWithReply(target);
    };

    // 본문이 차단 대상이면 숨기지 않고 내용만 교체.
    // 작성자 필터에 두면 아래 글 목록 행마다 본문 전체를 다시 읽고, .write_div 필터로 두면 파싱 중인 본문 일부로 판정해
    // NOT_*·SAME 항목이 오탐한 채 되돌릴 수 없게 바꿔 버린다 — 본문이 다 읽힌 뒤 한 번만 본다
    const checkText = (): void => {
        const writeDiv = document.querySelector<HTMLElement>(".write_div");
        if (writeDiv && isBlocked("TEXT", writeDiv.textContent?.trim() ?? "", gallery)) {
            writeDiv.textContent = "게시글 내용이 차단됐습니다.";
        }
    };

    ctx.addFilter(".ub-writer", checkWriter);
    ctx.addFilter(".written_dccon", checkDccon);

    if (isViewPage()) {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", checkText, {once: true});
            ctx.addCleanup(() => document.removeEventListener("DOMContentLoaded", checkText));
        } else {
            checkText();
        }
    }

    // 필터는 DOM 삽입 때만 돌아서, 차단 목록이 바뀌면 이미 그려진 요소를 직접 다시 판정한다.
    // 본문 TEXT 치환은 되돌릴 수 없으니 본문 차단을 풀면 새로고침 전까지는 그대로다
    ctx.addCleanup(useBlocksStore.subscribe((state, previous) => {
        if (state.entries === previous.entries && state.defaults === previous.defaults) return;

        restoreHiddenElements();
        document.querySelectorAll<HTMLElement>(".ub-writer").forEach(checkWriter);
        document.querySelectorAll<HTMLElement>(".written_dccon").forEach(checkDccon);
        if (isViewPage() && document.readyState !== "loading") checkText();
    }));
};

const setupSelection = (ctx: ModuleContext): void => {
    const onContextMenu = (event: MouseEvent): void => {
        const target = eventTarget(event);
        if (!(target instanceof Element)) return;

        const dcconElement = target.closest<HTMLElement>(".written_dccon");
        const hitElement = dcconElement ?? target.closest<HTMLElement>(".ub-writer");
        if (!hitElement) return;

        const ui = useUiStore.getState();

        if (dcconElement) {
            const code = dcconCode(dcconElement);
            if (!code) return;

            ui.setSelected({dccon: code});
        } else {
            const {nick, uid, ip} = hitElement.dataset;
            if (!nick && !uid && !ip) return;

            ui.setSelected({nick, uid, ip});
        }

        // 유저 버블: 네이티브 우클릭 메뉴 대체
        event.preventDefault();
        ui.openBubble(event.clientX, event.clientY);
    };

    document.addEventListener("contextmenu", onContextMenu, true);
    ctx.addCleanup(() => document.removeEventListener("contextmenu", onContextMenu, true));

    const offRequestBlock = ctx.bus.on("refresherRequestBlock", ({data: options}) => {
        void handleBlockRequest(options, useUiStore.getState().selected);
    });
    ctx.addCleanup(() => void offRequestBlock());
};

const restoreHiddenElements = (): void => {
    for (const element of document.querySelectorAll<HTMLElement>(".refresherBlocked")) {
        element.classList.remove("refresherBlocked");
        element.style.display = "";
    }

    for (const element of document.querySelectorAll<HTMLElement>(".refresherBlur")) {
        element.classList.remove("refresherBlur");
    }
};

export default defineModule({
    id: "block",
    name: "컨텐츠 차단",
    description: "유저, 컨텐츠 등의 보고 싶지 않은 컨텐츠들을 삭제합니다.",
    urls: [/\/board\/(view|lists)/],
    defaultEnable: true,

    settings: {
        replyRemove: {
            type: "check",
            name: "대댓글 삭제",
            desc: "차단된 댓글의 대댓글을 함께 삭제합니다.",
            default: false
        },
        blur: {
            type: "check",
            name: "블러 처리",
            desc: "차단된 내용을 블러 처리합니다.",
            default: false
        }
    },

    setup(ctx) {
        const gallery = queryString("id") ?? undefined;

        setupFilters(ctx, gallery);
        setupSelection(ctx);
    },

    revoke() {
        restoreHiddenElements();
    }
});
