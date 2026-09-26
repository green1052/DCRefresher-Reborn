import {overlay} from "@/components/overlay/shadow";

/** 실제 이벤트 대상. document/window 리스너에선 오버레이(shadow DOM) 안 요소가 shadow host로 재지정되므로 composedPath로 복원 */
export const eventTarget = (ev: Event): EventTarget | null => ev.composedPath()[0] ?? ev.target;

/**
 * 누른 키 (소문자). 한글 입력 상태면 ev.key가 'ㅇ'·'Process'라 영문·숫자는 물리 키(code)로 본다 —
 * 옵션 화면이 저장하는 키와 미리보기가 비교하는 키가 같은 기준이어야 단축키가 조용히 안 먹는 일이 없다
 */
export const pressedKey = (ev: Pick<KeyboardEvent, "code" | "key">): string =>
    (/^(?:Key|Digit)([A-Z\d])$/.exec(ev.code)?.[1] ?? ev.key).toLowerCase();

/** 입력칸에 타이핑 중이거나 다이얼로그(메모·차단·캡차 등)가 떠 있는지 (단축키 무시용) — 입력칸 밖에 포커스가 있어도 뒤의 글을 지우거나 넘기지 않게 */
export const isTyping = (ev: Event): boolean => {
    if (overlay.portal?.querySelector(".rt-BaseDialogOverlay")) return true;

    const target = eventTarget(ev);
    return target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
};
