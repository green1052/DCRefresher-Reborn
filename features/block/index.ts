import {BLOCKED_TEXT, dcconCode, groupDuplicates, HIDDEN_ROW_SELECTOR, isAnyBlocked, isBlocked, ROWS_HIDDEN_EVENT} from "@/core/block";
import {defineModule} from "@/core/module/define";
import {isViewPage, queryString} from "@/core/http/urls";
import {ROW_SELECTOR} from "@/core/list";
import type {BlockType} from "@/core/storage/types";
import {useBlocksStore} from "@/stores/blocks";
import {openWriterBubble, useUiStore} from "@/stores/ui";
import {whenDomReady} from "@/utils/dom";
import {eventTarget} from "@/utils/event";

import meta, {type Ctx, REVEAL_TOGGLE} from "./meta";

/** 요소 글자 — 안에 든 <script> 글자는 뺀다. */
const plainText = (element: Element | null | undefined): string =>
    element ? Array.from(element.childNodes, (node) => (node.nodeName === "SCRIPT" ? "" : node.textContent)).join("").trim() : "";

/** 보기 방식(블러)만 바꾸는 설정. 이것만 바뀌면 다시 판정하지 않는다. */
const BLUR_KEYS = new Set(["blurReveal", "blurStrength"]);

/** 블러 강도·마우스 오버 보기는 <html>의 변수·클래스로만 건다 (assets/styles/content.css). 행마다 JS를 붙이지 않아도 새로 그려진 행에 그대로 먹는다. */
const applyBlurStyle = (ctx: Ctx): void => {
    const root = document.documentElement;
    root.style.setProperty("--refresher-blur", `${ctx.settings.blurStrength}px`);
    root.classList.toggle("refresherBlurReveal", ctx.settings.blurReveal);
};

const duplicateOf = (ctx: Ctx): { count: number; minLength: number } | null =>
    ctx.settings.foldDuplicate ? {count: ctx.settings.duplicateCount, minLength: ctx.settings.duplicateMinLength} : null;

/**
 * 이 페이지에서만 차단 내용 보기. 저장하지 않아 새로고침하면 다시 가린다.
 * 상태는 <html>의 이 클래스 하나뿐이라(assets/styles/content.css) 확장이 업데이트되어 다시 주입된 인스턴스도 같은 상태를 읽는다.
 */
const REVEAL_CLASS = "refresherBlockReveal";
const isRevealed = (): boolean => document.documentElement.classList.contains(REVEAL_CLASS);

/** 이 모듈이 요소를 가릴 때 다는 클래스 (차단 숨김·블러·같은 댓글 접기). */
const HIDDEN_CLASSES = ["refresherBlocked", "refresherBlur", "refresherDuplicate"];
const HIDDEN_SELECTOR = HIDDEN_CLASSES.map((name) => `.${name}`).join(", ");
/** '가린 내용 보기'가 보이는 요소. userinfo의 깡계 흐림·숨김도 같이 보인다 (assets/styles/content.css). */
const REVEALED_SELECTOR = `${HIDDEN_ROW_SELECTOR}, .refresherDuplicate`;

/** 미리보기도 페이지와 같은 방식으로 가리게 알린다. */
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

/** setup()이 돌려주는 객체. 단축키와 팝업이 쓴다. */
interface BlockApi {
    isRevealed(): boolean;

    /** 이 페이지에서 가린 요소 수. */
    hiddenCount(): number;

    toggleReveal(): void;
}

/** 작성자 칸(checkWriter)이 보는 차단 유형. */
const WRITER_TYPES: BlockType[] = ["NICK", "ID", "IP", "TITLE", "TAB", "COMMENT"];

const setupFilters = (ctx: Ctx, gallery: string | undefined): (() => void) => {
    // 숨김도 클래스로만 건다 (assets/styles/content.css). 풀 때 디시가 건 인라인 display를 건드리지 않는다.
    const hide = (element: HTMLElement): void => element.classList.add(ctx.settings.blur ? "refresherBlur" : "refresherBlocked");

    const hideWithReply = (target: HTMLElement): void => {
        hide(target);

        if (!ctx.settings.replyRemove) return;

        const next = target.nextElementSibling;
        if (next instanceof HTMLElement && !next.classList.contains("ub-content") && next.querySelector(":scope > .reply")) {
            hide(next);
        }
    };

    // 유저/제목/말머리/댓글 차단.
    const checkWriter = (element: HTMLElement): void => {
        // 행마다 도는 일이라 목록이 빈 유형은 글자를 꺼내지도 않는다.
        const {entries} = useBlocksStore.getState();
        const read = (type: BlockType, value: () => string | null | undefined): string | null => (entries[type].length > 0 ? value() || null : null);
        if (!WRITER_TYPES.some((type) => entries[type].length > 0)) return;

        // 제목·말머리는 작성자 칸이 아니라 같은 행의 다른 칸에 있다. 글 보기 머리(.gallview_head)도 ub-content다.
        const row = element.closest<HTMLElement>(ROW_SELECTOR);
        const {nick, uid, ip} = element.dataset;

        const blocked = isAnyBlocked(
            {
                NICK: read("NICK", () => nick),
                ID: read("ID", () => uid),
                IP: read("IP", () => ip),
                TITLE: read("TITLE", () => plainText(row?.querySelector(".gall_tit > a:not([class]), .title_subject"))),
                // 잘린 말머리는 툴팁(.subject_inner)에 전체가 있다. 글 보기 머리의 말머리는 [대괄호]로 감싸 있다.
                TAB: read("TAB", () => plainText(row?.querySelector(".gall_subject .subject_inner, .title_headtext") ?? row?.querySelector(".gall_subject")).replace(/^\[(.*)\]$/, "$1")),
                // 글자콘 댓글은 .usertxt 없이 .comment_dccon > .coment_dccon_txt > .txtcon_txt로 그려진다. 그 글자도 댓글 차단어로 본다.
                // 댓글 검색 결과 행은 댓글 내용이 .sch_cmt에 있다. 미리보기 댓글(processComments)처럼 앞뒤 공백을 떼야 일치 검사가 같다.
                COMMENT: read("COMMENT", () => (isViewPage ? element.closest(".reply_info, .cmt_info") : null)?.querySelector(".usertxt, .txtcon_txt")?.textContent ?? row?.querySelector(".sch_cmt")?.textContent)?.trim()
            },
            gallery
        );

        if (blocked) hideWithReply(row ?? element);
    };

    const checkDccon = (element: HTMLElement): void => {
        const code = dcconCode(element);
        if (!code || !isBlocked("DCCON", code, gallery)) return;

        // 행이나 댓글 칸이 없는 본문 디시콘은 그 디시콘만 가린다.
        const target = element.closest<HTMLElement>(".ub-content") ?? element.closest<HTMLElement>(".comment_dccon");
        if (target) hideWithReply(target);
        else hide(element);
    };

    // 본문 차단: 블러면 흐리게, 아니면 숨기고 안내를 넣는다. 원문은 남겨 두어 차단을 풀거나 '차단 내용 보기'로 다시 보인다.
    // 본문이 다 읽힌 뒤 한 번만 본다. 작성자 필터에서 보면 아래 글 목록 행마다 본문을 다시 읽고,
    // .write_div 필터에서 보면 파싱 중인 본문 일부로 판정해 NOT_*·SAME 항목이 오탐한다.
    const checkText = (): void => {
        const writeDiv = document.querySelector<HTMLElement>(".write_div");
        if (!writeDiv) return;
        // 글 보기 머리(작성자·제목·말머리)가 차단됐으면 본문도 가린다. 머리 필터는 본문이 그려지기 전에 돌아 여기서 본다.
        const headBlocked = document.querySelector(".gallview_head:is(.refresherBlocked, .refresherBlur)") !== null;
        if (!headBlocked && !isBlocked("TEXT", writeDiv.textContent?.trim() ?? "", gallery)) return;

        // 확장이 업데이트되어 다시 주입되면 앞 인스턴스가 넣은 안내가 남아 있다. 안내가 둘 쌓이지 않게 먼저 뗀다.
        for (const element of document.querySelectorAll(".refresherTextNotice")) element.remove();
        hide(writeDiv);
        if (ctx.settings.blur) return;

        writeDiv.before(Object.assign(document.createElement("div"), {className: "refresherTextNotice", textContent: BLOCKED_TEXT}));
    };

    // 같은 댓글 접기. 댓글 목록은 댓글 페이지를 넘기거나 새로 고칠 때마다 통째로 다시 그려져 필터로 다시 불린다.
    // 차단·깡계로 가린 댓글(대댓글은 감싼 칸이 가려진다)은 세지 않는다. 세면 가려진 댓글이 배지를 가져가 같은 내용의 다른 댓글까지 모두 사라진다.
    // 미리보기(core/preview/comments)도 차단된 댓글을 빼고 센다.
    // 가린 댓글이 바뀌면 다시 접으므로 지난 판정의 표시도 맞춰 뗀다. 같은 결과면 DOM을 건드리지 않는다.
    // 배지를 넣거나 빼면 조상인 목록에 필터가 다시 불리므로, 바꿀 것이 없을 때 아무것도 하지 않아야 끝없이 돌지 않는다.
    const foldDuplicates = (list: HTMLElement): void => {
        const duplicate = duplicateOf(ctx);
        if (!duplicate) return;

        const textOf = (item: HTMLElement): string => item.querySelector(".usertxt")?.textContent ?? "";
        const all = [...list.querySelectorAll<HTMLElement>("li.ub-content")];
        const groups = groupDuplicates(all.filter((item) => !item.closest(HIDDEN_ROW_SELECTOR)), textOf, duplicate);
        for (const item of all) {
            const repeats = groups.get(item);
            item.classList.toggle("refresherDuplicate", repeats === 0);

            const text = repeats ? `같은 댓글 ×${repeats}` : undefined;
            const existing = item.querySelector(".refresherDuplicateBadge");
            if (existing?.textContent === text) continue;
            existing?.remove();
            if (text) item.querySelector(".usertxt")?.after(Object.assign(document.createElement("span"), {className: "refresherDuplicateBadge", textContent: text}));
        }
    };
    // userinfo는 같은 필터 묶음에서 이 필터 뒤에 깡계를 가린다. 그 뒤에 접도록 미룬다.
    const foldLater = (list: HTMLElement): void => queueMicrotask(() => {
        if (!ctx.signal.aborted && list.isConnected) foldDuplicates(list);
    });

    // 선택자마다 판정. 새로 그려지는 요소는 필터가, 이미 그려진 요소는 recheck가 같은 표로 돈다.
    const checks: [selector: string, check: (element: HTMLElement) => void][] = [[".ub-writer", checkWriter], [".written_dccon", checkDccon]];
    if (isViewPage) checks.push([".cmt_list", foldLater]);
    for (const [selector, check] of checks) ctx.addFilter(selector, check);
    if (isViewPage) {
        whenDomReady(checkText, ctx.signal);
        // 글댓비를 받아 깡계를 새로 가리면(또는 풀면) 댓글 수가 달라져 다시 접는다.
        document.addEventListener(ROWS_HIDDEN_EVENT, () => {
            for (const list of document.querySelectorAll<HTMLElement>(".cmt_list")) foldDuplicates(list);
        }, {signal: ctx.signal});
    }

    // 필터는 DOM 삽입 때만 돈다. 차단 목록이나 숨기는 방식(블러/대댓글)이 바뀌면 이미 그려진 요소를 직접 다시 판정한다.
    const recheck = (): void => {
        restoreHiddenElements();
        for (const [selector, check] of checks) {
            for (const element of document.querySelectorAll<HTMLElement>(selector)) check(element);
        }
        if (isViewPage && document.readyState !== "loading") checkText();
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
        // 작성자 칸을 유저 정보 모듈이 먼저 받아 버블을 열었으면 defaultPrevented다.
        if (ev.shiftKey || ev.defaultPrevented) return;

        const target = eventTarget(ev);
        const dcconElement = target instanceof Element ? target.closest<HTMLElement>(".written_dccon") : null;
        // 작성자 칸 버블은 유저 정보 모듈과 같이 쓴다.
        if (!dcconElement) {
            openWriterBubble(ev);
            return;
        }

        const code = dcconCode(dcconElement);
        if (!code) return;

        ev.preventDefault();
        useUiStore.getState().openBubble({dccon: code}, ev.clientX, ev.clientY);
    };

    document.addEventListener("contextmenu", onContextMenu, {capture: true, signal: ctx.signal});
};

const restoreHiddenElements = (): void => {
    for (const element of document.querySelectorAll(HIDDEN_SELECTOR)) element.classList.remove(...HIDDEN_CLASSES);

    for (const element of document.querySelectorAll(".refresherTextNotice, .refresherDuplicateBadge")) element.remove();
};

export default defineModule({
    ...meta,

    setup(ctx) {
        const gallery = queryString("id") ?? undefined;

        applyBlurStyle(ctx);
        publishView(ctx);
        const recheck = setupFilters(ctx, gallery);
        setupSelection(ctx);
        ctx.onSettingsChanged((keys) => {
            publishView(ctx);
            if (!keys.isDisjointFrom(BLUR_KEYS)) applyBlurStyle(ctx);
            if (!keys.isSubsetOf(BLUR_KEYS)) recheck();
        });

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
        ...REVEAL_TOGGLE,
        desc: (api) => `가린 ${api.hiddenCount()}개를 흐리게 보입니다`,
        isOn: (api) => api.isRevealed(),
        toggle: (api) => api.toggleReveal()
    }],

    revoke() {
        restoreHiddenElements();
        useUiStore.setState({blockView: null});
        document.documentElement.style.removeProperty("--refresher-blur");
        document.documentElement.classList.remove("refresherBlurReveal", REVEAL_CLASS);
    }
});
