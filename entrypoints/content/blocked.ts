import {setBlockedHandler} from "@/core/http/client";
import {BLOCKED_PAGE_MESSAGE} from "@/core/pages";
import {useUiStore} from "@/stores/ui";
import {whenDomReady} from "@/utils/dom";

/**
 * 디시에 임시 차단되면 모든 요청에 빈 페이지가 온다(상태 코드는 200). 확장이 고장 난 것처럼 보이므로 이유를 알린다.
 * 막혀 있는 동안은 요청마다 불리므로 1분에 한 번만 띄운다. 요청이 막혀 띄운 알림은 1분 뒤 닫는다 — 닫히지 않으면 차단이 이어지는 동안
 * 같은 알림이 1분마다 쌓여 다른 알림을 밀어낸다. 지금 페이지 자체가 막혔으면 다시 불리지 않으므로 닫힐 때까지 둔다.
 */
export const warnWhenBlocked = (): void => {
    let blockedWarnedAt = 0;
    const warnBlocked = (autoClose = 60_000): void => {
        if (Date.now() - blockedWarnedAt < 60_000) return;
        blockedWarnedAt = Date.now();
        useUiStore.getState().showToast(BLOCKED_PAGE_MESSAGE, "warning", autoClose);
    };
    setBlockedHandler(() => warnBlocked());
    // 지금 페이지 자체가 빈 페이지인 경우.
    const warnIfBlocked = (): void => {
        // 삭제된 글·없는 갤러리는 <script>로 알림을 띄우거나 이동만 하는 빈 페이지다. 차단이 아니다.
        if (Array.from(document.scripts).some((script) => /location\.|history\.|alert\(/.test(script.textContent ?? ""))) return;
        // 확장이 body에 붙인 UI(오버레이, 스텔스 버튼 등 data-refresher-ui)는 디시 내용이 아니다. 그 글자도 세지 않는다.
        // 보통 페이지는 첫 자식부터 디시 요소라 거기서 끝난다.
        for (const node of document.body?.childNodes ?? []) {
            if (node instanceof Element ? node.tagName !== "REFRESHER-ROOT" && !node.hasAttribute("data-refresher-ui") : node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) return;
        }
        warnBlocked(0);
    };
    whenDomReady(warnIfBlocked);
};
