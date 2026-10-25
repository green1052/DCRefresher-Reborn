import {BLOCKED_TEXT, dcconCode, duplicateOf, groupDuplicates, HIDDEN_ROW_SELECTOR, isAnyBlocked, isBlocked, isImageBlocked, ROWS_HIDDEN_EVENT, similarImageThreshold, VIDEO_CHECK_EVENTS} from "@/core/block";
import {FILTER_SKIP_ATTR} from "@/core/filtering";
import {defineModule} from "@/core/module/define";
import {isViewPage, pageGallery} from "@/core/http/urls";
import {onMessage} from "@/core/messaging/protocol";
import {WRITER_ROW_SELECTOR} from "@/core/list";
import type {BlockType} from "@/core/storage/types";
import {blockImage} from "@/stores/blockRequest";
import {useBlocksStore} from "@/stores/blocks";
import {openWriterBubble, useUiStore} from "@/stores/ui";
import {textWithoutScripts, whenDomReady} from "@/utils/dom";
import {eventTarget} from "@/utils/event";

import meta, {type Ctx} from "./meta";

/** 보기 방식(블러)만 바꾸는 설정. 이것만 바뀌면 다시 판정하지 않는다. */
const BLUR_KEYS = new Set<keyof Ctx["settings"]>(["blurReveal", "blurStrength"]);

/** 블러 강도·마우스 오버 보기는 <html>의 변수·클래스로만 건다 (assets/styles/content.css). 행마다 JS를 붙이지 않아도 새로 그려진 행에 그대로 먹는다. */
const applyBlurStyle = (ctx: Ctx): void => {
    const root = document.documentElement;
    root.style.setProperty("--refresher-blur", `${ctx.settings.blurStrength}px`);
    root.classList.toggle("refresherBlurReveal", ctx.settings.blurReveal);
};

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

/** 미리보기도 '가린 내용 보기'를 따르게 알린다. 가리는 방식은 미리보기가 이 모듈의 설정에서 바로 읽는다. */
const publishRevealed = (): void => useUiStore.setState({blockRevealed: isRevealed()});

const hiddenCount = (): number => document.querySelectorAll(REVEALED_SELECTOR).length;

const toggleReveal = (): void => {
    document.documentElement.classList.toggle(REVEAL_CLASS);
    publishRevealed();

    useUiStore.getState().showToast(isRevealed() ? `이 페이지에서 가린 내용을 보입니다. (${hiddenCount()}개)` : "가린 내용을 다시 숨겼습니다.");
};

/** 작성자 칸(checkWriter)이 보는 차단 유형. */
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

        // 제목·말머리는 작성자 칸이 아니라 같은 행의 다른 칸에 있다. 글 보기 머리(.gallview_head)도 ub-content다.
        const row = element.closest<HTMLElement>(WRITER_ROW_SELECTOR);
        const {nick, uid, ip} = element.dataset;

        const blocked = isAnyBlocked(
            {
                NICK: read("NICK", () => nick),
                ID: read("ID", () => uid),
                IP: read("IP", () => ip),
                TITLE: read("TITLE", () => textWithoutScripts(row?.querySelector(".gall_tit > a:not([class]), .title_subject"))),
                // 잘린 말머리는 툴팁(.subject_inner)에 전체가 있다. 글 보기 머리의 말머리는 [대괄호]로 감싸 있다.
                TAB: read("TAB", () => textWithoutScripts(row?.querySelector(".gall_subject .subject_inner, .title_headtext") ?? row?.querySelector(".gall_subject")).replace(/^\[(.*)\]$/, "$1")),
                // 글자콘 댓글은 .usertxt 없이 .txtcon_txt에, 댓글 검색 결과 행은 .sch_cmt에 내용이 있다.
                // 미리보기 댓글(processComments)처럼 앞뒤 공백을 떼야 일치 검사가 같다.
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

    // 본문 이미지·움짤(<video>) 차단. 파일 해시로 보므로 다 받은 뒤에 본다. 지연 로딩·디시의 가린 이미지 보기로 주소가 바뀌면 load 때,
    // 움짤은 VIDEO_CHECK_EVENTS 때 다시 본다. 디시가 움짤을 gif <img>로 바꾸면 그 <img>는 필터가 따로 본다.
    const watchedImages = new WeakSet<HTMLElement>();
    const checkImage = (element: HTMLElement): void => {
        if (!(element instanceof HTMLImageElement || element instanceof HTMLVideoElement)) return;
        if (!watchedImages.has(element)) {
            watchedImages.add(element);
            for (const type of element instanceof HTMLImageElement ? ["load"] : VIDEO_CHECK_EVENTS) {
                element.addEventListener(type, () => checkImage(element), {signal: ctx.signal});
            }
        }
        // 지문은 한 번에 하나씩 구해 늦게 끝난다. 그사이 비슷한 이미지 설정이 바뀌면 recheck가 새 기준으로 다시 보므로 옛 기준의 결과는 버린다.
        const threshold = similarImageThreshold(ctx.settings);
        void isImageBlocked(element, gallery, threshold).then((blocked) => {
            if (blocked && !ctx.signal.aborted && similarImageThreshold(ctx.settings) === threshold) hide(element);
        });
    };

    // 본문 차단은 본문이 다 읽힌 뒤 한 번만 본다. 작성자 필터에서 보면 아래 글 목록 행마다 본문을 다시 읽고,
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

    // 같은 댓글 접기. 댓글 목록은 페이지를 넘기거나 새로 고칠 때마다 통째로 다시 그려져 필터로 다시 불린다.
    // 차단·깡계로 가린 댓글(대댓글은 감싼 칸이 가려진다)은 세지 않는다(core/preview/comments도 같다). 세면 가려진 댓글이 배지를 가져가 같은 내용의 다른 댓글까지 모두 사라진다.
    // 지난 판정의 표시는 맞춰 떼되 결과가 같으면 DOM을 건드리지 않는다. 배지를 넣거나 빼면 조상인 목록에 필터가 다시 불려 끝없이 돈다.
    const foldDuplicates = (list: HTMLElement): void => {
        const duplicate = duplicateOf(ctx.settings);
        if (!duplicate) return;

        // 글자콘 댓글은 .txtcon_txt에 글이 있다 (checkWriter의 COMMENT). 미리보기도 글자콘 글로 묶는다.
        const textOf = (item: HTMLElement): string => item.querySelector(".usertxt, .txtcon_txt")?.textContent ?? "";
        const all = [...list.querySelectorAll<HTMLElement>("li.ub-content")];
        const shown = all.filter((item) => !item.closest(HIDDEN_ROW_SELECTOR));
        // 접힌 댓글의 답글 칸을 남기면 그 답글이 위 댓글의 답글처럼 보여, 대댓글 가리기(replyRemove)와 상관없이 같이 접는다.
        // 접을 답글 칸은 댓글끼리만 묶어 정하고, 그 칸의 답글은 세지 않는다. 세면 같이 접힐 답글이 배지를 가져간다.
        // 답글을 더해 세도 이 댓글들은 계속 접히므로, 답글 덕에 새로 접히는 댓글의 답글 칸만 남는다.
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
    const checks: [selector: string, check: (element: HTMLElement) => void][] = [[".ub-writer", checkWriter], [".written_dccon", checkDccon]];
    if (isViewPage) checks.push([".cmt_list", foldLater], [".write_div :is(img, video)", checkImage]);
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
        ctx.addCleanup(onMessage("refresher:blockImage", ({data: url}) => blockImage(url)));
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
