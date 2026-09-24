import {block} from "@/core/block";
import type {ModuleContext, ModuleDefinition} from "@/core/module/types";
import {queryString} from "@/core/http/urls";
import {useUiStore} from "@/stores/ui";

import {handleBlockRequest} from "./request";

/** 디시콘 이미지 URL에서 디시콘 코드(no 파라미터) 추출 */
const extractDcconCode = (src: string): string => src.replace(/^.*no=/, "").replace(/&.*$/, "");

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
    ctx.addFilter(
        ".ub-writer",
        (element) => {
            const title = element.querySelector(".gall_tit > a:not([class])")?.textContent;
            const tab = element.querySelector(".gall_subject")?.textContent;
            const commentContainer = isViewPage() ? element.closest(".reply_info, .cmt_info") : null;
            const comment = commentContainer?.querySelector(".usertxt")?.textContent;
            const {nick, uid, ip} = element.dataset;

            const blocked = block.checkAll(
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

            if (blocked) {
                hideWithReply((element.closest<HTMLElement>(".ub-content")) ?? element);
                return;
            }

            // 본문이 차단 대상이면 숨기지 않고 내용만 교체
            if (isViewPage() && !commentContainer) {
                const writeDiv = document.querySelector<HTMLElement>(".write_div");
                if (writeDiv && block.check("TEXT", writeDiv.textContent ?? "")) {
                    writeDiv.textContent = "게시글 내용이 차단됐습니다.";
                }
            }
        },
        {neverExpire: true}
    );

    // 디시콘 차단
    ctx.addFilter(
        ".written_dccon",
        (element) => {
            const img = (element as HTMLImageElement).src ? (element as HTMLImageElement) : element.querySelector("img");
            const src = img?.getAttribute("src") ?? img?.getAttribute("data-src");
            if (!src) return;

            if (!block.check("DCCON", extractDcconCode(src), gallery)) return;

            const target = (element.closest<HTMLElement>(".ub-content")) ?? (element.closest<HTMLElement>(".comment_dccon"));
            if (target) hideWithReply(target);
        },
        {neverExpire: true}
    );
};

const setupSelection = (ctx: ModuleContext): void => {
    const onContextMenu = (event: MouseEvent): void => {
        const target = event.target;
        if (!(target instanceof Element)) return;

        const dcconElement = target.closest<HTMLElement>(".written_dccon");
        const hitElement = dcconElement ?? target.closest<HTMLElement>(".ub-writer");
        if (!hitElement) return;

        console.log("[refresher] 우클릭 감지:", hitElement.className, {...hitElement.dataset});

        const ui = useUiStore.getState();

        if (dcconElement) {
            const media = (dcconElement as HTMLImageElement).src
                ? (dcconElement as HTMLImageElement)
                : (dcconElement.querySelector("img, video, source") ?? dcconElement);
            const src = media.getAttribute("src") ?? media.getAttribute("data-src");
            if (!src) return;

            const code = extractDcconCode(src);
            ui.setSelected({dccon: code});
        } else {
            const {nick, uid, ip} = hitElement.dataset;
            if (!nick && !uid && !ip) return;

            ui.setSelected({nick, uid, ip});
        }

        // 유저 버블: 네이티브 우클릭 메뉴 대체
        event.preventDefault();
        ui.closeBubble();
        ui.openBubble(event.clientX, event.clientY);
        console.log("[refresher] 버블 열림:", event.clientX, event.clientY);
    };

    document.addEventListener("contextmenu", onContextMenu, true);
    ctx.addCleanup(() => document.removeEventListener("contextmenu", onContextMenu, true));

    ctx.bus.on("refresherRequestBlock", ({data: options}) => {
        void handleBlockRequest(options, useUiStore.getState().selected);
    });
};

export const restoreHiddenElements = (): void => {
    for (const element of document.querySelectorAll<HTMLElement>(".refresherBlocked")) {
        element.classList.remove("refresherBlocked");
        element.style.display = "";
    }

    for (const element of document.querySelectorAll<HTMLElement>(".refresherBlur")) {
        element.classList.remove("refresherBlur");
    }
};

const blockModule: ModuleDefinition = {
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
        console.log("[refresher] block 모듈 시작, gallery:", gallery);

        setupFilters(ctx, gallery);
        setupSelection(ctx);
    },

    revoke() {
        restoreHiddenElements();
    }
};

export default blockModule;
