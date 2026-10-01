import type {GalleryPreData} from "@/core/preview/types";

import type {Ctx} from "./meta";
import type {createMini} from "./mini";
import {buildPreData} from "./rows";
import {usePreviewStore} from "./ui/previewStore";

interface RowHandlers {
    open(preData: GalleryPreData, commentsOnly: boolean): void;
    /** 우클릭을 누르는 동안 본문을 미리 받는다. */
    prefetch(preData: GalleryPreData): void;
    mini: ReturnType<typeof createMini>;
}

/**
 * 목록 행·제목 칸의 마우스 입력. 우클릭(짧게)·좌클릭(키 반전)으로 미리보기를 열고, 제목 칸에는 미니 미리보기를 붙인다.
 * 우클릭 길게 누르기는 브라우저 메뉴로 남긴다.
 */
export const bindRows = (ctx: Ctx, {open, prefetch, mini}: RowHandlers): void => {
    let pressStart = 0;
    let preventOpen = false;

    // 우클릭 길게 누르기: mousedown에서 시각을 기록하고, mouseup에서 판정해 contextmenu에서 쓴다.
    const onMouseDown = (ev: MouseEvent) => {
        if (ev.button !== 2) return;
        pressStart = Date.now();
        preventOpen = false;

        // 윈도우는 contextmenu가 버튼을 뗄 때 오므로, 누르고 있는 동안 본문을 미리 받는다.
        // Shift+우클릭(브라우저 메뉴)과 키 반전(우클릭은 글 이동)이면 열지 않으니 받지 않는다.
        if (ev.shiftKey || ctx.settings.reversePreviewKey) return;
        const resolved = resolveTarget(ev);
        if (!resolved) return;
        prefetch(resolved.preData);
        // 오버레이도 처음 쓸 때 띄우므로(수십 ms) 떼기를 기다리는 동안 미리 띄운다.
        // 다음 task에서 한다. 여기서 띄우면 오버레이 모듈 초기화가 마이크로태스크로 먼저 돌아 본문 요청이 그만큼 늦게 나간다.
        if (!usePreviewStore.getState().warm) window.setTimeout(() => usePreviewStore.setState({warm: true}));
    };

    const onMouseUp = (ev: MouseEvent) => {
        if (ev.button !== 2 || pressStart === 0) return;

        const delay = ctx.settings.longPressDelay || 300;
        if (Date.now() - delay > pressStart) preventOpen = true;
        pressStart = 0;
    };

    // 제목 칸(.ub-word) 안에서 난 이벤트는 제목 칸 핸들러가 이미 처리했다. 버블링으로 받은 행 핸들러는 건너뛴다.
    const handledByWord = (element: HTMLElement, target: HTMLElement): boolean =>
        element.classList.contains("ub-content") && target.closest(".ub-word") !== null;

    // 우클릭·좌클릭·미리 받기가 같은 기준으로 대상을 고르게 한 곳에서 판정한다.
    // link: 키 반전 우클릭으로 이동할 주소. 댓글 수는 그 링크(댓글 위치, t=cv)다.
    const resolveTarget = (ev: MouseEvent): { preData: GalleryPreData; commentsOnly: boolean; link: string } | null => {
        const element = ev.currentTarget as HTMLElement;
        const target = ev.target as HTMLElement;
        if (handledByWord(element, target)) return null;

        // 댓글 수 링크는 댓글만 보기로 연다. 행 전체 인식이 꺼져 있어도 열리게 아래 검사보다 먼저 본다.
        const replyLink = target.closest<HTMLAnchorElement>("a.reply_numbox");
        const commentsOnly = replyLink !== null;

        if (!commentsOnly) {
            if (element.classList.contains("ub-content") && !ctx.settings.expandRecognizeRange) return null;

            // 작성자 칸 클릭은 유저 버블(차단·유저 정보 모듈) 몫이라 행 전체 인식이어도 열지 않는다.
            if (target.closest(".ub-writer")) return null;
        }

        const preData = buildPreData(element);
        return preData ? {preData, commentsOnly, link: replyLink?.href || preData.link} : null;
    };

    const onContextMenu = (ev: MouseEvent) => {
        // Shift+우클릭은 브라우저 메뉴로 남긴다. 맥·리눅스는 누르는 순간 메뉴가 떠서 길게 누르기로는 열 수 없다.
        if (ev.shiftKey) return;

        const resolved = resolveTarget(ev);
        if (!resolved) return;

        // 길게 눌렀으면 키 반전이어도 기본 우클릭 메뉴다.
        if (preventOpen) {
            preventOpen = false;
            return;
        }

        // 짧게 눌렀으면 미리보기다. 키 반전이면 글(댓글 수는 그 댓글 위치)로 이동한다.
        ev.preventDefault();
        if (ctx.settings.reversePreviewKey) location.href = resolved.link;
        else open(resolved.preData, resolved.commentsOnly);
    };

    const onClick = (ev: MouseEvent) => {
        // 수정키 클릭(새 탭·창으로 열기, manage 모듈의 Ctrl+클릭 삭제)은 가로채지 않는다.
        if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey) return;

        // 좌클릭은 키 반전일 때만 미리보기다. 아니면 제목·댓글 수 모두 원래대로 링크를 연다.
        if (!ctx.settings.reversePreviewKey) return;
        const resolved = resolveTarget(ev);
        if (!resolved) return;

        ev.preventDefault();
        open(resolved.preData, resolved.commentsOnly);
    };

    // 같은 함수는 addEventListener로 두 번 붙지 않아, 필터가 같은 요소로 다시 불러도 괜찮다. 그래서 핸들러는 모두 여기 밖에서 한 번 만든다.
    const bind = (element: HTMLElement, word: boolean) => {
        const options = {signal: ctx.signal};

        element.addEventListener("mousedown", onMouseDown, options);
        element.addEventListener("mouseup", onMouseUp, options);
        element.addEventListener("contextmenu", onContextMenu, options);
        element.addEventListener("click", onClick, options);

        if (word) {
            element.addEventListener("mouseenter", mini.onMiniEnter, options);
            element.addEventListener("mousemove", mini.onMiniMove, options);
            element.addEventListener("mouseleave", mini.onMiniLeaveSoon, options);
        }
    };

    ctx.addFilter(
        ".gall_list .ub-word",
        (element) => bind(element, true)
    );

    ctx.addFilter(
        ".gall_list .ub-content",
        (element) => bind(element, false)
    );
};
