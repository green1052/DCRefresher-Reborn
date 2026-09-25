import {groupDuplicates, isAnyBlocked, isBlocked} from "@/core/block";
import {defineModule} from "@/core/module/define";
import type {ModuleContext, SettingGroup} from "@/core/module/types";
import {isViewPage, queryString} from "@/core/http/urls";
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

const BLUR_GROUP: SettingGroup = {name: "블러 처리", desc: "차단된 내용을 지우지 않고 블러 처리합니다."};

/** 블러 강도·마우스 오버 보기는 <html>의 변수/클래스로만 건다 — 행마다 JS를 붙이지 않고 새로 그려진 행에도 그대로 먹는다 (content.scss) */
const applyBlurStyle = (ctx: ModuleContext): void => {
    const root = document.documentElement;
    root.style.setProperty("--refresher-blur", `${Number(ctx.settings.blurStrength)}px`);
    root.classList.toggle("refresherBlurReveal", ctx.settings.blurReveal === true);
};

const DUPLICATE_GROUP: SettingGroup = {name: "같은 댓글 접기", desc: "같은 내용의 댓글이 여러 번 달리면 첫 댓글만 남기고 접습니다. 미리보기에도 적용됩니다."};

const duplicateOf = (ctx: ModuleContext): { count: number; minLength: number } | null =>
    ctx.settings.foldDuplicate === true ? {count: Number(ctx.settings.duplicateCount), minLength: Number(ctx.settings.duplicateMinLength)} : null;

/** 이 페이지에서만 차단 내용 보기 — 저장하지 않는다 (새로고침하면 다시 가린다). 보이는 방식은 <html>의 클래스 (content.scss) */
let revealed = false;
const REVEAL_CLASS = "refresherBlockReveal";

/** 이 모듈이 가린 요소 */
const HIDDEN_SELECTOR = ".refresherBlocked, .refresherBlur, .refresherDuplicate";

/** 미리보기도 페이지와 같은 방식으로 가리게 알린다 */
const publishView = (ctx: ModuleContext): void => {
    useUiStore.setState({
        blockView: {
            blur: ctx.settings.blur === true,
            blurReveal: ctx.settings.blurReveal === true,
            replyRemove: ctx.settings.replyRemove === true,
            revealed,
            duplicate: duplicateOf(ctx)
        }
    });
};

/** setup()이 돌려주는 객체 — 단축키와 팝업이 쓴다 */
export interface BlockApi {
    isRevealed(): boolean;

    /** 이 페이지에서 가린 요소 수 */
    hiddenCount(): number;

    toggleReveal(): void;
}

const setupFilters = (ctx: ModuleContext, gallery: string | undefined): (() => void) => {
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
        const commentContainer = isViewPage ? element.closest(".reply_info, .cmt_info") : null;
        // 글자콘 댓글은 .usertxt 없이 .comment_dccon > .coment_dccon_txt > .txtcon_txt로 그려진다 — 글자도 댓글 차단어로 본다
        const comment = commentContainer?.querySelector(".usertxt, .txtcon_txt")?.textContent;
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

    // 본문 차단: 블러면 흐리게, 아니면 숨기고 안내를 넣는다 — 원문은 그대로 둬 차단을 풀거나 '차단 내용 보기'로 다시 보인다.
    // 작성자 필터에 두면 아래 글 목록 행마다 본문 전체를 다시 읽고, .write_div 필터로 두면 파싱 중인 본문 일부로 판정해
    // NOT_*·SAME 항목이 오탐한다 — 본문이 다 읽힌 뒤 한 번만 본다
    const checkText = (): void => {
        const writeDiv = document.querySelector<HTMLElement>(".write_div");
        if (!writeDiv || !isBlocked("TEXT", writeDiv.textContent?.trim() ?? "", gallery)) return;

        hide(writeDiv, useBlur());
        if (useBlur()) return;

        const notice = document.createElement("div");
        notice.className = "refresherTextNotice";
        notice.textContent = "게시글 내용이 차단됐습니다.";
        writeDiv.before(notice);
    };

    // 같은 댓글 접기 — 글 페이지의 댓글 목록은 댓글 페이지를 넘기거나 새로 고칠 때마다 통째로 다시 그려진다
    const foldDuplicates = (list: HTMLElement): void => {
        const duplicate = duplicateOf(ctx);
        if (!duplicate) return;

        const textOf = (item: HTMLElement): string => item.querySelector(".usertxt")?.textContent ?? "";
        for (const [item, repeats] of groupDuplicates([...list.querySelectorAll<HTMLElement>("li.ub-content")], textOf, duplicate)) {
            if (repeats === 0) {
                item.classList.add("refresherDuplicate");
                continue;
            }

            // 멱등이어야 한다 — 배지를 넣으면 필터가 조상인 목록에 다시 불려, 같은 배지를 또 넣으면 끝없이 돈다
            const text = `같은 댓글 ×${repeats}`;
            const existing = item.querySelector(".refresherDuplicateBadge");
            if (existing?.textContent === text) continue;
            existing?.remove();

            const badge = document.createElement("span");
            badge.className = "refresherDuplicateBadge";
            badge.textContent = text;
            item.querySelector(".usertxt")?.after(badge);
        }
    };

    ctx.addFilter(".ub-writer", checkWriter);
    ctx.addFilter(".written_dccon", checkDccon);
    if (isViewPage) ctx.addFilter(".cmt_list", foldDuplicates);

    if (isViewPage) {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", checkText, {once: true});
            ctx.addCleanup(() => document.removeEventListener("DOMContentLoaded", checkText));
        } else {
            checkText();
        }
    }

    // 필터는 DOM 삽입 때만 돌아서, 차단 목록이나 숨기는 방식(블러/대댓글)이 바뀌면 이미 그려진 요소를 직접 다시 판정한다.
    // 본문 TEXT 치환은 되돌릴 수 없으니 본문 차단을 풀면 새로고침 전까지는 그대로다
    const recheck = (): void => {
        restoreHiddenElements();
        for (const element of document.querySelectorAll<HTMLElement>(".ub-writer")) checkWriter(element);
        for (const element of document.querySelectorAll<HTMLElement>(".written_dccon")) checkDccon(element);
        if (isViewPage) {
            for (const element of document.querySelectorAll<HTMLElement>(".cmt_list")) foldDuplicates(element);
            if (document.readyState !== "loading") checkText();
        }
    };

    ctx.addCleanup(useBlocksStore.subscribe((state, previous) => {
        if (state.entries === previous.entries && state.defaults === previous.defaults) return;
        recheck();
    }));

    return recheck;
};

const setupSelection = (ctx: ModuleContext): void => {
    const onContextMenu = (ev: MouseEvent): void => {
        // Shift+우클릭은 유저 버블 대신 브라우저 기본 메뉴를 연다 (링크 복사·요소 검사 등이 막히지 않게)
        if (ev.shiftKey) return;

        const target = eventTarget(ev);
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
        ev.preventDefault();
        ui.openBubble(ev.clientX, ev.clientY);
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

    for (const element of document.querySelectorAll<HTMLElement>(".refresherDuplicate")) {
        element.classList.remove("refresherDuplicate");
    }

    for (const element of document.querySelectorAll<HTMLElement>(".refresherTextNotice, .refresherDuplicateBadge")) {
        element.remove();
    }
};

/** 설정(블러/대댓글)이 바뀌면 onChanged가 setup의 판정 함수로 다시 그린다 */
let recheck: (() => void) | undefined;

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
            group: BLUR_GROUP,
            name: "사용",
            desc: "차단된 내용을 블러 처리합니다.",
            default: false
        },
        blurReveal: {
            type: "check",
            group: BLUR_GROUP,
            name: "마우스를 올리면 보기",
            desc: "블러 처리된 내용에 마우스를 올린 동안 원래대로 보여 줍니다.",
            default: true
        },
        blurStrength: {
            type: "range",
            group: BLUR_GROUP,
            name: "강도",
            desc: "차단된 내용에 거는 블러의 세기입니다.",
            default: 5,
            min: 1,
            max: 20,
            step: 1,
            unit: "px"
        },
        foldDuplicate: {
            type: "check",
            group: DUPLICATE_GROUP,
            name: "사용",
            desc: "같은 댓글을 한 줄로 접습니다.",
            default: false
        },
        duplicateCount: {
            type: "range",
            group: DUPLICATE_GROUP,
            name: "반복 횟수",
            desc: "이만큼 반복되면 접습니다.",
            default: 3,
            min: 2,
            max: 10,
            step: 1,
            unit: "번"
        },
        duplicateMinLength: {
            type: "range",
            group: DUPLICATE_GROUP,
            name: "최소 글자 수",
            desc: "이보다 짧은 댓글(ㅋㅋ 등)은 반복돼도 접지 않습니다.",
            default: 5,
            min: 1,
            max: 50,
            step: 1,
            unit: "자"
        }
    },

    shortcuts: {
        blockReveal: (_ctx, api) => (api as BlockApi | undefined)?.toggleReveal()
    },

    setup(ctx) {
        const gallery = queryString("id") ?? undefined;

        applyBlurStyle(ctx);
        publishView(ctx);
        recheck = setupFilters(ctx, gallery);
        ctx.addCleanup(() => (recheck = undefined));
        setupSelection(ctx);

        const api: BlockApi = {
            isRevealed: () => revealed,
            hiddenCount: () => document.querySelectorAll(HIDDEN_SELECTOR).length,
            toggleReveal: () => {
                revealed = !revealed;
                document.documentElement.classList.toggle(REVEAL_CLASS, revealed);
                publishView(ctx);

                useUiStore.getState().showToast(revealed ? `이 페이지에서 가린 내용을 보입니다. (${api.hiddenCount()}개)` : "가린 내용을 다시 숨겼습니다.");
            }
        };
        return api;
    },

    onChanged(ctx, key) {
        publishView(ctx);
        // 보기 방식만 바뀌면 다시 판정할 필요 없다
        if (key === "blurReveal" || key === "blurStrength") applyBlurStyle(ctx);
        else recheck?.();
    },

    revoke() {
        restoreHiddenElements();
        revealed = false;
        useUiStore.setState({blockView: null});
        document.documentElement.style.removeProperty("--refresher-blur");
        document.documentElement.classList.remove("refresherBlurReveal", REVEAL_CLASS);
    }
});
