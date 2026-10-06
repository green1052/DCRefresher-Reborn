import {overlay} from "@/components/overlay/shadow";

/** 실제 이벤트 대상. document/window 리스너에서는 shadow DOM 안 요소가 shadow host로 재지정되므로 composedPath로 되찾는다. */
export const eventTarget = (ev: Event): EventTarget | null => ev.composedPath()[0] ?? ev.target;

/**
 * 누른 키(소문자). 한글 입력 상태에서는 ev.key가 'ㅇ'·'Process'가 되므로 영문·숫자는 물리 키(code)로 읽는다.
 * 옵션 화면이 키를 저장할 때와 미리보기가 비교할 때 모두 이 함수를 써야 단축키가 어긋나지 않는다.
 */
export const pressedKey = (ev: Pick<KeyboardEvent, "code" | "key">): string =>
    (/^(?:Key|Digit)([A-Z\d])$/.exec(ev.code)?.[1] ?? ev.key).toLowerCase();

/**
 * 단축키를 무시해야 하는지. 입력칸에 타이핑 중이거나 다이얼로그(메모·차단·캡차 등)가 떠 있으면 true다.
 * 다이얼로그는 포커스가 입력칸 밖에 있어도 막아야 뒤의 글을 지우거나 넘기지 않는다.
 */
export const isTyping = (ev: Event): boolean => {
    // 모달 다이얼로그(components/ui/dialog.tsx)의 배경. 미리보기 창(비모달)과 이미지 크게 보기는 저마다 키를 받으므로 세지 않는다.
    if (overlay.portal?.querySelector("[data-slot=dialog-overlay]")) return true;

    const target = eventTarget(ev);
    return target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
};
