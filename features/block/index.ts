import {BLOCKED_TEXT, dcconCode, duplicateOf, groupDuplicates, HIDDEN_ROW_SELECTOR, isAnyBlocked, isBlocked, ROWS_HIDDEN_EVENT} from "@/core/block";
import {FILTER_SKIP_ATTR} from "@/core/filtering";
import {defineModule} from "@/core/module/define";
import {isViewPage, pageGallery} from "@/core/http/urls";
import {BLOCK_TYPES} from "@/core/storage/items";
import {WRITER_ROW_SELECTOR} from "@/core/list";
import type {BlockType} from "@/core/storage/types";
import {useBlocksStore} from "@/stores/blocks";
import {openWriterBubble, useUiStore} from "@/stores/ui";
import {textWithoutScripts, whenDomReady} from "@/utils/dom";
import {eventTarget} from "@/utils/event";

import meta, {type Ctx} from "./meta";

/** 보기 방식(블러)만 바꾸는 설정. 이것만 바뀌면 다시 판정하지 않는다. */
const BLUR_KEYS = new Set<keyof Ctx["settings"]>(["blurReveal", "blurStrength"]);

type BlocksState = ReturnType<typeof useBlocksStore.getState>;

/** 항목이 뒤로만 더해졌나. 더해지기만 했으면 이미 가린 요소는 다시 보지 않는다. 지우기, 수정, NOT_* 추가는 가림이 풀릴 수 있어 전체 재판정이다. */
const isAdditiveChange = (previous: BlocksState, state: BlocksState): boolean => {
    if (state.defaults !== previous.defaults) return false;
    return BLOCK_TYPES.every((type) => {
        const next = state.entries[type];
        const old = previous.entries[type];
        return next === old || (next.length > old.length
            && old.every((entry, i) => entry === next[i])
            // NOT_*는 허용 목록이라 더하면 가림이 풀릴 수 있다. mode 없는 항목은 기본 모드를 따른다.
            && next.slice(old.length).every((entry) => !(entry.mode ?? state.defaults[type]).startsWith("NOT_")));
    });
};

/** 블러 강도, 마우스 오버 보기는 <html>의 변수, 클래스로만 건다 (assets/styles/content.css). 행마다 JS를 붙이지 않아도 새로 그려진 행에 그대로 먹는다. */
const applyBlurStyle = (ctx: Ctx): void => {
    const root = document.documentElement;
    root.style.setProperty("--refresher-blur", `${ctx.settings.blurStrength}px`);
    root.classList.toggle("refresherBlurReveal", ctx.settings.blurReveal);
};

/** 이 페이지에서만 차단 내용 보기. <html> 클래스 하나뿐이라 재주입 인스턴스도 같은 상태를 읽는다. */
const REVEAL_CLASS = "refresherBlockReveal";
const isRevealed = (): boolean => document.documentElement.classList.contains(REVEAL_CLASS);

/** 이 모듈이 요소를 가릴 때 다는 클래스 (차단 숨김, 블러, 같은 댓글 접기). */
const HIDDEN_CLASSES = ["refresherBlocked", "refresherBlur", "refresherDuplicate"];
const HIDDEN_SELECTOR = HIDDEN_CLASSES.map((name) => `.${name}`).join(", ");
/** '가린 내용 보기'가 보이는 요소. userinfo의 깡계 흐림, 숨김도 같이 보인다 (assets/styles/content.css). */
const REVEALED_SELECTOR = `${HIDDEN_ROW_SELECTOR}, .refresherDuplicate`;

/** 미리보기도 '가린 내용 보기'를 따르게 알린다. 가리는 방식은 미리보기가 이 모듈의 설정에서 바로 읽는다. */
const publishRevealed = (): void => useUiStore.setState({blockRevealed: isRevealed()});

const hiddenCount = (): number => document.querySelectorAll(REVEALED_SELECTOR).length;

const toggleReveal = (): void => {
    document.documentElement.classList.toggle(REVEAL_CLASS);
    publishRevealed();

    useUiStore.getState().showToast(isRevealed() ? `이 페이지에서 가린 내용을 보입니다. (${hiddenCount()}개)` : "가린 내용을 다시 숨겼습니다.");
};

const WRITER_TYPES: BlockType[] = ["NICK", "ID", "IP", "TITLE", "TAB", "COMMENT"];

const setupFilters = (ctx: Ctx, gallery: string | undefined): (() => void) => {
    // 숨김도 클래스로만 건다 (assets/styles/content.css). 풀 때 디시가 건 인라인 display를 건드리지 않는다.
    const hide = (element: HTMLElement): void => element.classList.add(ctx.settings.blur ? "refresherBlur" : "refresherBlocked");

    /** 댓글의 답글 칸. 디시는 답글을 댓글 다음 형제 <li>의 .reply 안에 그린다. */
    const replyBoxOf = (target: HTMLElement): HTMLElement | null => {
        const next = target.nextElementSibling;
        return next instanceof HTMLElement && !next.classList.contains("ub-content") && next.querySelector(":scope > .reply") ? next : null;
    };

    const hideWithReply = (target: HTMLElement): void => {
        hide(target);

        const replies = ctx.settings.replyRemove ? replyBoxOf(target) : null;
        if (replies) hide(replies);
    };

    const checkWriter = (element: HTMLElement): void => {
        // 행마다 도는 일이라 목록이 빈 유형은 글자를 꺼내지도 않는다.
        const {entries} = useBlocksStore.getState();
        const read = (type: BlockType, value: () => string | null | undefined): string | null => (entries[type].length > 0 ? value() || null : null);
        if (!WRITER_TYPES.some((type) => entries[type].length > 0)) return;

        // 제목, 말머리는 작성자 칸이 아니라 같은 행의 다른 칸에 있다. 글 보기 머리(.gallview_head)도 ub-content다.
        const row = element.closest<HTMLElement>(WRITER_ROW_SELECTOR);
        const {nick, uid, ip} = element.dataset;

        const blocked = isAnyBlocked(
            {
                NICK: read("NICK", () => nick),
                ID: read("ID", () => uid),
                IP: read("IP", () => ip),
                TITLE: read("TITLE", () => textWithoutScripts(row?.querySelector(".gall_tit > a:not([class]), .title_subject"))),
                // 잘린 말머리는 툴팁(.subject_inner)에 전체가 있다. 글 보기 머리의 말머리는 [대괄호]로 감싸 있다.
                TAB: read("TAB", () => textWithoutScripts(row?.querySelector(".gall_subject .subject_inner, .title_headtext") ?? row?.querySelector(".gall_subject")).replace(/^\[(.*)]$/, "$1")),
                // 글자콘 댓글은 .txtcon_txt에, 댓글 검색 행은 .sch_cmt에 내용이 있다. 앞뒤 공백을 떼야 일치 검사가 같다.
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


    // 본문 차단은 다 읽힌 뒤 한 번만 본다. 필터에서 보면 행마다 다시 읽거나 파싱 중 일부로 오탐한다.
    const checkText = (): void => {
        const writeDiv = document.querySelector<HTMLElement>(".write_div");
        if (!writeDiv) return;
        // 글 보기 머리(작성자, 제목, 말머리)가 차단됐으면 본문도 가린다. 머리 필터는 본문이 그려지기 전에 돌아 여기서 본다.
        const headBlocked = document.querySelector(".gallview_head:is(.refresherBlocked, .refresherBlur)") !== null;
        if (!headBlocked && !isBlocked("TEXT", writeDiv.textContent?.trim() ?? "", gallery)) return;

        // 확장이 업데이트되어 다시 주입되면 앞 인스턴스가 넣은 안내가 남아 있다. 안내가 둘 쌓이지 않게 먼저 뗀다.
        for (const element of document.querySelectorAll(".refresherTextNotice")) element.remove();
        hide(writeDiv);
        if (ctx.settings.blur) return;

        writeDiv.before(Object.assign(document.createElement("div"), {className: "refresherTextNotice", textContent: BLOCKED_TEXT}));
    };

    // 같은 댓글 접기. 가린 댓글은 세지 않고(세면 배지가 다른 댓글까지 없앤다) 결과가 같으면 DOM을 건드리지 않는다.
    const foldDuplicates = (list: HTMLElement): void => {
        const duplicate = duplicateOf(ctx.settings);
        if (!duplicate) return;

        // 글자콘 댓글은 .txtcon_txt에 글이 있다 (checkWriter의 COMMENT). 미리보기도 글자콘 글로 묶는다.
        const textOf = (item: HTMLElement): string => item.querySelector(".usertxt, .txtcon_txt")?.textContent ?? "";
        const all = [...list.querySelectorAll<HTMLElement>("li.ub-content")];
        const shown = all.filter((item) => !item.closest(HIDDEN_ROW_SELECTOR));
        // 접힌 댓글의 답글 칸도 같이 접는다 (남기면 위 댓글의 답글처럼 보인다). 답글 칸을 뺀 댓글끼리만 묶어 정한다.
        const foldedBoxes = new Set<HTMLElement>();
        for (const [item, repeats] of groupDuplicates(shown.filter((item) => !item.closest(".reply")), textOf, duplicate)) {
            const box = repeats === 0 ? replyBoxOf(item) : null;
            if (box) foldedBoxes.add(box);
        }
        // 댓글마다 Set을 다시 펼치지 않는다.
        const boxes = [...foldedBoxes];
        const groups = groupDuplicates(shown.filter((item) => !boxes.some((box) => box.contains(item))), textOf, duplicate);
        for (const item of all) {
            const repeats = groups.get(item);
            item.classList.toggle("refresherDuplicate", repeats === 0);
            const box = replyBoxOf(item);
            box?.classList.toggle("refresherDuplicate", foldedBoxes.has(box));

            const text = repeats ? `같은 댓글 ×${repeats}` : undefined;
            const existing = item.querySelector(".refresherDuplicateBadge");
            if (existing?.textContent === text) continue;
            existing?.remove();
            if (!text) continue;
            const badge = Object.assign(document.createElement("span"), {className: "refresherDuplicateBadge", textContent: text});
            // 붙이지 않으면 core/filtering이 배지를 감싼 댓글 목록을 다시 잡아 한 번 더 접는다.
            badge.setAttribute(FILTER_SKIP_ATTR, "");
            // 글자콘은 크기가 정해진 상자(.coment_dccon_txt) 안이 아니라 디시콘 칸(.comment_dccon) 뒤에 붙인다.
            item.querySelector(".usertxt, .comment_dccon")?.after(badge);
        }
    };
    // userinfo는 같은 필터 묶음에서 이 필터 뒤에 깡계를 가린다. 그 뒤에 접도록 미룬다.
    const foldLater = (list: HTMLElement): void => queueMicrotask(() => {
        if (!ctx.signal.aborted && list.isConnected) foldDuplicates(list);
    });

    // 선택자마다 판정. 새로 그려지는 요소는 필터가, 이미 그려진 요소는 recheck가 같은 표로 돈다.
    const checks: [selector: string, check: (element: HTMLElement, again?: boolean) => void][] = [[".ub-writer", checkWriter], [".written_dccon", checkDccon]];
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
    const recheck = (skipHidden = false): void => {
        if (!skipHidden) restoreHiddenElements();
        for (const [selector, check] of checks) {
            for (const element of document.querySelectorAll<HTMLElement>(selector)) {
                // 항목이 더해지기만 했으면 이미 가린 요소는 가려진 채로 넘어간다. 접기(.cmt_list)는 보이는 댓글이 달라졌으니 다시 묶는다.
                if (skipHidden && selector !== ".cmt_list" && element.closest(HIDDEN_ROW_SELECTOR)) continue;
                check(element, true);
            }
        }
        if (isViewPage && document.readyState !== "loading") checkText();
    };

    ctx.addCleanup(useBlocksStore.subscribe((state, previous) => {
        if (state.entries === previous.entries && state.defaults === previous.defaults) return;
        recheck(isAdditiveChange(previous, state));
    }));

    return recheck;
};

const setupSelection = (ctx: Ctx): void => {
    const onContextMenu = (ev: MouseEvent): void => {
        // Shift+우클릭은 브라우저 기본 메뉴, 유저 정보 모듈이 버블을 열었으면(defaultPrevented) 건너뛴다.
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

export default defineModule(meta, {
    setup(ctx) {
        ctx.onRevoke(() => {
            restoreHiddenElements();
            useUiStore.setState({blockRevealed: false});
            document.documentElement.style.removeProperty("--refresher-blur");
            document.documentElement.classList.remove("refresherBlurReveal", REVEAL_CLASS);
        });

        const gallery = pageGallery ?? undefined;

        applyBlurStyle(ctx);
        publishRevealed();
        const recheck = setupFilters(ctx, gallery);
        setupSelection(ctx);
        ctx.onSettingsChanged((keys) => {
            if (!keys.isDisjointFrom(BLUR_KEYS)) applyBlurStyle(ctx);
            if (!keys.isSubsetOf(BLUR_KEYS)) recheck();
        });

        // 단축키와 팝업이 쓴다.
        return {isRevealed, hiddenCount, toggleReveal};
    },

    shortcuts: {
        blockReveal: (api) => api.toggleReveal()
    },

    pageToggles: {
        reveal: {
            desc: (api) => `가린 ${api.hiddenCount()}개를 흐리게 보입니다`,
            isOn: (api) => api.isRevealed(),
            toggle: (api) => api.toggleReveal()
        }
    }
});
