import {Ban, Eye} from "lucide-react";

import {BLOCKED_TEXT, dcconCode, groupDuplicates, isAnyBlocked, isBlocked} from "@/core/block";
import {defineModule} from "@/core/module/define";
import type {ModuleContext, SettingGroup, SettingsSchema} from "@/core/module/types";
import {isViewPage, queryString} from "@/core/http/urls";
import {ROW_SELECTOR} from "@/core/list";
import {BOARD_PAGE} from "@/core/pages";
import {useBlocksStore} from "@/stores/blocks";
import {openWriterBubble, useUiStore} from "@/stores/ui";
import {whenDomReady} from "@/utils/dom";
import {eventTarget} from "@/utils/event";

/** 요소 글자 — 안에 든 <script> 글자는 뺀다 */
const plainText = (element: Element | null | undefined): string =>
    element ? Array.from(element.childNodes, (node) => (node.nodeName === "SCRIPT" ? "" : node.textContent)).join("").trim() : "";

const BLUR_GROUP: SettingGroup = {name: "흐리게 처리", desc: "차단된 내용을 숨기지 않고 흐리게 처리합니다."};

/** 블러 강도·마우스 오버 보기는 <html>의 변수·클래스로만 건다 (content.scss). 행마다 JS를 붙이지 않아도 새로 그려진 행에 그대로 먹는다 */
const applyBlurStyle = (ctx: Ctx): void => {
    const root = document.documentElement;
    root.style.setProperty("--refresher-blur", `${ctx.settings.blurStrength}px`);
    root.classList.toggle("refresherBlurReveal", ctx.settings.blurReveal);
};

const DUPLICATE_GROUP: SettingGroup = {name: "같은 댓글 접기", desc: "같은 내용의 댓글이 여러 번 달리면 첫 댓글만 남기고 접습니다. 미리보기에도 적용됩니다."};

const duplicateOf = (ctx: Ctx): { count: number; minLength: number } | null =>
    ctx.settings.foldDuplicate ? {count: ctx.settings.duplicateCount, minLength: ctx.settings.duplicateMinLength} : null;

/**
 * 이 페이지에서만 차단 내용 보기. 저장하지 않아 새로고침하면 다시 가린다. 보이는 방식은 <html>의 클래스로 정한다 (content.scss).
 * 상태도 그 클래스 하나뿐이다. 확장이 업데이트되어 다시 주입된 인스턴스도 같은 상태를 읽는다
 */
const REVEAL_CLASS = "refresherBlockReveal";
const isRevealed = (): boolean => document.documentElement.classList.contains(REVEAL_CLASS);

/** 이 모듈이 가린 요소 */
const HIDDEN_SELECTOR = ".refresherBlocked, .refresherBlur, .refresherDuplicate";
/** '가린 내용 보기'가 보이는 요소. userinfo의 깡계 흐림·숨김도 같이 보인다 (content.scss) */
const REVEALED_SELECTOR = `${HIDDEN_SELECTOR}, .refresherLowActivityHide, .refresherLowActivityBlur`;

/** 미리보기도 페이지와 같은 방식으로 가리게 알린다 */
const publishView = (ctx: Ctx): void => {
    useUiStore.setState({
        blockView: {
            blur: ctx.settings.blur,
            blurReveal: ctx.settings.blurReveal,
            replyRemove: ctx.settings.replyRemove,
            revealed: isRevealed(),
            duplicate: duplicateOf(ctx)
        }
    });
};

/** setup()이 돌려주는 객체. 단축키와 팝업이 쓴다 */
interface BlockApi {
    isRevealed(): boolean;

    /** 이 페이지에서 가린 요소 수 */
    hiddenCount(): number;

    toggleReveal(): void;
}

const setupFilters = (ctx: Ctx, gallery: string | undefined): (() => void) => {
    const useBlur = () => ctx.settings.blur;

    // 숨김도 클래스로만 건다 (content.scss). 풀 때 디시가 건 인라인 display를 건드리지 않는다
    const hide = (element: HTMLElement, blur: boolean): void => element.classList.add(blur ? "refresherBlur" : "refresherBlocked");

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
        // 제목·말머리는 작성자 칸이 아니라 같은 행의 다른 칸에 있다. 글 보기 머리(.gallview_head)도 ub-content다
        const row = element.closest<HTMLElement>(ROW_SELECTOR);
        const title = plainText(row?.querySelector(".gall_tit > a:not([class]), .title_subject"));
        // 잘린 말머리는 툴팁(.subject_inner)에 전체가 있다. 글 보기 머리의 말머리는 [대괄호]로 감싸 있다
        const tab = plainText(row?.querySelector(".gall_subject .subject_inner, .title_headtext") ?? row?.querySelector(".gall_subject")).replace(/^\[(.*)\]$/, "$1");
        const commentContainer = isViewPage ? element.closest(".reply_info, .cmt_info") : null;
        // 글자콘 댓글은 .usertxt 없이 .comment_dccon > .coment_dccon_txt > .txtcon_txt로 그려진다. 그 글자도 댓글 차단어로 본다
        // 댓글 검색 결과 행은 댓글 내용이 .sch_cmt에 있다
        const comment = commentContainer?.querySelector(".usertxt, .txtcon_txt")?.textContent ?? row?.querySelector(".sch_cmt")?.textContent;
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

        // 행이나 댓글 칸이 없는 본문 디시콘은 그 디시콘만 가린다
        const target = element.closest<HTMLElement>(".ub-content") ?? element.closest<HTMLElement>(".comment_dccon");
        if (target) hideWithReply(target);
        else hide(element, useBlur());
    };

    // 본문 차단: 블러면 흐리게, 아니면 숨기고 안내를 넣는다. 원문은 남겨 두어 차단을 풀거나 '차단 내용 보기'로 다시 보인다.
    // 본문이 다 읽힌 뒤 한 번만 본다. 작성자 필터에서 보면 아래 글 목록 행마다 본문을 다시 읽고,
    // .write_div 필터에서 보면 파싱 중인 본문 일부로 판정해 NOT_*·SAME 항목이 오탐한다
    const checkText = (): void => {
        const writeDiv = document.querySelector<HTMLElement>(".write_div");
        if (!writeDiv) return;
        // 글 보기 머리(작성자·제목·말머리)가 차단됐으면 본문도 가린다. 머리 필터는 본문이 그려지기 전에 돌아 여기서 본다
        const headBlocked = document.querySelector(".gallview_head:is(.refresherBlocked, .refresherBlur)") !== null;
        if (!headBlocked && !isBlocked("TEXT", writeDiv.textContent?.trim() ?? "", gallery)) return;

        // 확장이 업데이트되어 다시 주입되면 앞 인스턴스가 넣은 안내가 남아 있다. 안내가 둘 쌓이지 않게 먼저 뗀다
        for (const element of document.querySelectorAll(".refresherTextNotice")) element.remove();
        hide(writeDiv, useBlur());
        if (useBlur()) return;

        const notice = document.createElement("div");
        notice.className = "refresherTextNotice";
        notice.textContent = BLOCKED_TEXT;
        writeDiv.before(notice);
    };

    // 같은 댓글 접기. 댓글 목록은 댓글 페이지를 넘기거나 새로 고칠 때마다 통째로 다시 그려져 필터로 다시 불린다
    const foldDuplicates = (list: HTMLElement): void => {
        const duplicate = duplicateOf(ctx);
        if (!duplicate) return;

        const textOf = (item: HTMLElement): string => item.querySelector(".usertxt")?.textContent ?? "";
        for (const [item, repeats] of groupDuplicates([...list.querySelectorAll<HTMLElement>("li.ub-content")], textOf, duplicate)) {
            if (repeats === 0) {
                item.classList.add("refresherDuplicate");
                continue;
            }

            // 멱등이어야 한다. 배지를 넣으면 조상인 목록에 필터가 다시 불리므로, 같은 배지를 또 넣으면 끝없이 돈다
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

    if (isViewPage) whenDomReady(checkText, ctx.signal);

    // 필터는 DOM 삽입 때만 돈다. 차단 목록이나 숨기는 방식(블러/대댓글)이 바뀌면 이미 그려진 요소를 직접 다시 판정한다
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

const setupSelection = (ctx: Ctx): void => {
    const onContextMenu = (ev: MouseEvent): void => {
        // Shift+우클릭은 유저 버블 대신 브라우저 기본 메뉴를 연다 (링크 복사·요소 검사 등이 막히지 않게).
        // 작성자 칸을 유저 정보 모듈이 먼저 받아 버블을 열었으면 defaultPrevented다
        if (ev.shiftKey || ev.defaultPrevented) return;

        const target = eventTarget(ev);
        const dcconElement = target instanceof Element ? target.closest<HTMLElement>(".written_dccon") : null;
        // 작성자 칸 버블은 유저 정보 모듈과 같이 쓴다
        if (!dcconElement) {
            openWriterBubble(ev);
            return;
        }

        const code = dcconCode(dcconElement);
        if (!code) return;

        const ui = useUiStore.getState();
        ui.setSelected({dccon: code});
        // 브라우저 우클릭 메뉴 대신 디시콘 차단 버블을 연다
        ev.preventDefault();
        ui.openBubble(ev.clientX, ev.clientY);
    };

    document.addEventListener("contextmenu", onContextMenu, {capture: true, signal: ctx.signal});
};

const restoreHiddenElements = (): void => {
    for (const element of document.querySelectorAll(HIDDEN_SELECTOR)) element.classList.remove("refresherBlocked", "refresherBlur", "refresherDuplicate");

    for (const element of document.querySelectorAll<HTMLElement>(".refresherTextNotice, .refresherDuplicateBadge")) {
        element.remove();
    }
};

/** setup이 만든 다시 판정 함수. 설정(블러/대댓글 등)이 바뀌면 onChanged가 부른다 */
let recheck: (() => void) | undefined;

const settings = {
    replyRemove: {
        type: "check",
        name: "대댓글도 가리기",
        desc: "차단된 댓글의 대댓글도 함께 가립니다.",
        default: false
    },
    blur: {
        type: "check",
        group: BLUR_GROUP,
        name: "사용",
        desc: "차단된 내용을 흐리게 처리합니다.",
        default: false
    },
    blurReveal: {
        type: "check",
        group: BLUR_GROUP,
        name: "마우스를 올리면 보기",
        desc: "흐리게 처리된 내용에 마우스를 올린 동안 원래대로 보여 줍니다.",
        default: true
    },
    blurStrength: {
        type: "range",
        group: BLUR_GROUP,
        name: "강도",
        desc: "차단된 내용을 흐리게 하는 정도입니다.",
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
} satisfies SettingsSchema;

type Ctx = ModuleContext<typeof settings>;

export default defineModule({
    id: "block",
    name: "콘텐츠 차단",
    description: "보고 싶지 않은 유저·글·댓글을 숨기거나 흐리게 합니다.",
    icon: Ban,
    urls: [BOARD_PAGE],

    settings,

    setup(ctx) {
        const gallery = queryString("id") ?? undefined;

        applyBlurStyle(ctx);
        publishView(ctx);
        recheck = setupFilters(ctx, gallery);
        ctx.addCleanup(() => (recheck = undefined));
        setupSelection(ctx);

        const api: BlockApi = {
            isRevealed,
            hiddenCount: () => document.querySelectorAll(REVEALED_SELECTOR).length,
            toggleReveal: () => {
                document.documentElement.classList.toggle(REVEAL_CLASS);
                publishView(ctx);

                useUiStore.getState().showToast(isRevealed() ? `이 페이지에서 가린 내용을 보입니다. (${api.hiddenCount()}개)` : "가린 내용을 다시 숨겼습니다.");
            }
        };
        return api;
    },

    shortcuts: {
        blockReveal: (_ctx, api) => api.toggleReveal()
    },

    pageToggles: [{
        id: "reveal",
        label: "가린 내용 보기",
        desc: (api) => `가린 ${api.hiddenCount()}개를 흐리게 보입니다`,
        icon: Eye,
        isOn: (api) => api.isRevealed(),
        toggle: (api) => api.toggleReveal()
    }],

    onChanged(ctx, key) {
        publishView(ctx);
        // 보기 방식만 바뀌면 다시 판정할 필요 없다
        if (key === "blurReveal" || key === "blurStrength") applyBlurStyle(ctx);
        else recheck?.();
    },

    revoke() {
        restoreHiddenElements();
        useUiStore.setState({blockView: null});
        document.documentElement.style.removeProperty("--refresher-blur");
        document.documentElement.classList.remove("refresherBlurReveal", REVEAL_CLASS);
    }
});
