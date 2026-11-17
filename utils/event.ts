import {overlay} from "@/components/overlay/shadow";

/** 실제 이벤트 대상. document/window 리스너에서는 shadow DOM 안 요소가 shadow host로 재지정되므로 composedPath로 되찾는다. */
export const eventTarget = (ev: Event): EventTarget | null => ev.composedPath()[0] ?? ev.target;

/** 조합키를 같이 눌렀는지. 조합키는 브라우저 몫이라 가로채지 않는다. */
export const hasModifier = (ev: Pick<KeyboardEvent, "ctrlKey" | "altKey" | "metaKey" | "shiftKey">): boolean =>
    ev.ctrlKey || ev.altKey || ev.metaKey || ev.shiftKey;

/** 누른 키(소문자). 한글 입력 상태에선 ev.key가 'ㅇ'가 되어 영문·숫자는 code로 읽는다. */
export const pressedKey = (ev: Pick<KeyboardEvent, "code" | "key">): string =>
    (/^(?:Key|Digit)([A-Z\d])$/.exec(ev.code)?.[1] ?? ev.key).toLowerCase();

/** 모달 다이얼로그(components/ui/dialog.tsx, alert-dialog.tsx)의 배경. 떠 있으면 그 다이얼로그가 키를 받는다. */
export const MODAL_OVERLAY_SELECTOR = "[data-slot=dialog-overlay], [data-slot=alert-dialog-overlay]";

/** 단축키를 무시할지. 입력칸에 타이핑 중이거나 모달 다이얼로그가 떠 있으면 true. */
export const isTyping = (ev: Event): boolean => {
    // 미리보기 창(비모달)과 이미지 크게 보기는 저마다 키를 받으므로 세지 않는다.
    if (overlay.portal?.querySelector(MODAL_OVERLAY_SELECTOR)) return true;

    const target = eventTarget(ev);
    return target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
};
