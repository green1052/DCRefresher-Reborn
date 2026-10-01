import {setBlockedHandler} from "@/core/http/client";
import {BLOCKED_PAGE_MESSAGE} from "@/core/pages";
import {useUiStore} from "@/stores/ui";
import {whenDomReady} from "@/utils/dom";

/**
 * 디시에 임시 차단되면 모든 요청에 빈 페이지가 온다(상태 코드는 200). 확장이 고장 난 것처럼 보이므로 이유를 알린다.
 * 막혀 있는 동안은 요청마다 불리므로 1분에 한 번만 띄운다
 */
export const warnWhenBlocked = (): void => {
    let blockedWarnedAt = 0;
    const warnBlocked = (): void => {
        if (Date.now() - blockedWarnedAt < 60_000) return;
        blockedWarnedAt = Date.now();
        useUiStore.getState().showToast(BLOCKED_PAGE_MESSAGE, "warning", 0);
    };
    setBlockedHandler(warnBlocked);
    // 지금 페이지 자체가 빈 페이지인 경우
    const warnIfBlocked = (): void => {
        // 확장이 body에 붙인 UI(오버레이, 스텔스 버튼 등 data-refresher-ui)는 디시 내용이 아니다. 그 글자도 세지 않는다
        const nodes = Array.from(document.body?.childNodes ?? []);
        const content = nodes.filter((node) => node instanceof Element && node.tagName !== "REFRESHER-ROOT" && !node.hasAttribute("data-refresher-ui"));
        const text = nodes.some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
        if (content.length === 0 && !text) warnBlocked();
    };
    whenDomReady(warnIfBlocked);
};
