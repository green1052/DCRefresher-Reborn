import {LIST_REPLACED_EVENT, onMessage} from "@/core/messaging/protocol";
import {hasTab, runInPage} from "@/core/module/background";

declare global {
    interface Window {
        /** 디시 페이지 함수: 자체 차단(block-disable)을 건다. */
        chk_user_block?: (id: string) => void;
        /** 디시 이용자 메모. */
        UserMemo?: { renderWriterMemoBadges?: (wrapper: null) => void };
        /** 목록 다리를 이미 걸었다. 파이어폭스는 업데이트하면 콘텐츠 스크립트를 다시 넣어 다시 걸어 달라고 한다. */
        refresherListBridge?: true;
    }
}

// 페이지 컨텍스트에서 목록 교체 이벤트를 받아 디시 스크립트를 다시 건다 - 디시는 처음 그릴 때만 차단/메모 배지를 적용한다.
const installListBridge = (eventName: string): void => {
    if (window.refresherListBridge) return;
    window.refresherListBridge = true;

    document.addEventListener(eventName, (ev) => {
        if (!(ev instanceof CustomEvent) || typeof ev.detail !== "string") return;
        const gallery = ev.detail;

        // 디시가 페이지를 열 때 넘긴 값을 그대로 쓴다(미니 갤에서는 목록과 글 페이지 값이 다르다) - 찾으면 멈춘다.
        const loaded = Iterator.from(document.scripts).map((script) => /chk_user_block\('([^']*)'\)/.exec(script.textContent ?? "")?.[1]).find((id) => id !== undefined);
        if (typeof window.chk_user_block === "function") window.chk_user_block(loaded ?? gallery);
        // null이면 디시가 처음 그릴 때 등록한 범위(목록, 글 머리)를 다시 그린다.
        if (typeof window.UserMemo?.renderWriterMemoBadges === "function") window.UserMemo.renderWriterMemoBadges(null);
    });
};

/** 콘텐츠 스크립트가 요청하면 그 탭의 페이지(MAIN world)에서 대신 실행한다. */
export const listenPageMessages = (): void => {
    onMessage("refresher:installListBridge", async ({sender}) => {
        if (!hasTab(sender)) return;

        // 실패하면 콘텐츠 스크립트가 다음 목록 교체 때 다시 요청하도록 던진다.
        await runInPage(sender, installListBridge, [LIST_REPLACED_EVENT]);
    });
};
