import {onMessage} from "@/core/messaging/protocol";
import {hasTab, runInPage} from "@/core/module/background";

/**
 * 탭의 페이지 컨텍스트에서 실행된다(직렬화되므로 바깥 변수를 쓰지 않는다).
 * 디시는 목록을 처음 그릴 때만 자체 차단(block-disable)과 이용자 메모 배지를 적용하므로 교체한 행에 다시 건다.
 */
const rerunListScripts = (gallery: string): void => {
    const scope = window as Window & {
        chk_user_block?: (id: string) => void;
        UserMemo?: { renderWriterMemoBadges?: (wrapper: null) => void };
    };

    // 디시가 페이지를 열 때 넘긴 값을 그대로 쓴다. 미니 갤러리는 목록('id')과 글 페이지('mi$id')의 값이 달라 id로 짐작하면 다른 설정을 읽는다.
    // 목록을 바꿀 때마다 불리므로 찾으면 멈춘다 (배열로 펼쳐 map하면 페이지의 인라인 스크립트를 모두 훑는다).
    const loaded = Iterator.from(document.scripts).map((script) => /chk_user_block\('([^']*)'\)/.exec(script.textContent ?? "")?.[1]).find((id) => id !== undefined);
    if (typeof scope.chk_user_block === "function") scope.chk_user_block(loaded ?? gallery);
    // null이면 디시가 처음 그릴 때 등록한 범위(목록·글 머리)를 다시 그린다.
    if (typeof scope.UserMemo?.renderWriterMemoBadges === "function") scope.UserMemo.renderWriterMemoBadges(null);
};

/** 콘텐츠 스크립트가 요청하면 그 탭의 페이지(MAIN world)에서 대신 실행한다. */
export const listenPageMessages = (): void => {
    onMessage("refresher:listReplaced", async ({data: gallery, sender}) => {
        if (!hasTab(sender)) return;

        await runInPage(sender, rerunListScripts, [gallery]).catch(() => {});
    });
};
