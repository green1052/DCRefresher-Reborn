// 오버레이 CSS (components/overlay/styles.ts). 디시 페이지에 입히는 CSS는 entrypoints/page.content.css다.
import "@/components/overlay/styles";

import {releaseDatabase} from "@/core/database";
import {documentUrl} from "@/core/http/urls";
import {onMessage} from "@/core/messaging/protocol";
import {loadAll, pageToggleStates, runPageToggle, runShortcut, settledPageToggleStates, stopAll} from "@/core/module/registry";
import {BOARD_PAGE, CONTENT_EXCLUDE_MATCHES, CONTENT_MATCHES} from "@/core/pages";
import features from "@/features";
import {initBlocksStore} from "@/stores/blocks";
import {initMemosStore} from "@/stores/memos";

import {warnWhenBlocked} from "./blocked";
import {showInvalidatedNote} from "./invalidated";
import {mountOverlayWhenNeeded} from "./overlay";
import {cleanUpStaleInstance} from "./stale";

/**
 * 콘텐츠 스크립트. 디시 페이지마다 document_start에 돈다. 같은 폴더의 파일이 하나씩 맡는다:
 * - stale.ts: 파이어폭스 재주입으로 죽은 인스턴스가 남긴 것 걷어 내기
 * - invalidated.ts: 확장이 업데이트되거나 꺼졌을 때의 안내
 * - overlay.tsx: 오버레이(shadow DOM)를 처음 필요할 때 띄우기
 * - blocked.ts: 디시 임시 차단 안내.
 */
export default defineContentScript({
    matches: CONTENT_MATCHES,
    excludeMatches: CONTENT_EXCLUDE_MATCHES,
    runAt: "document_start",
    // CSS는 manifest가 아니라 오버레이를 처음 띄울 때 shadow에 넣는다. 오버레이를 띄우지 않는 페이지는 오버레이 CSS를 읽지 않는다.
    cssInjectionMode: "ui",
    // 새 인스턴스가 떴다는 알림을 페이지 창에 postMessage로 뿌리지 않는다 (이전 인스턴스 정리는 WXT가 CustomEvent로 한다).
    noScriptStartedPostMessage: true,
    async main(ctx) {
        cleanUpStaleInstance();

        // ===== 메시징 (배경·팝업→탭) =====
        onMessage("refresher:executeShortcut", ({data: command}) => runShortcut(command));

        onMessage("refresher:pageState", settledPageToggleStates);
        onMessage("refresher:pageAction", ({data: action}) => {
            runPageToggle(action);
            return pageToggleStates();
        });

        // 확장을 끄거나 업데이트해도 이 스크립트는 남아 새로고침 폴링·저장소 호출을 하다 실패하므로 모듈을 멈춘다.
        // 부트스트랩의 await보다 먼저 등록한다. 저장소를 읽는 중에 무효화되면 그 호출이 실패하거나 끝나지 않아 await 뒤의 등록까지 가지 못한다.
        ctx.onInvalidated(() => {
            stopAll();
            releaseDatabase();
            // 새 스크립트가 주입되어 무효화된 경우(확장은 살아 있음)는 새 스크립트가 이어서 돌므로 알리지 않는다.
            if (browser.runtime?.id) return;
            showInvalidatedNote();
        });
        // WXT는 ctx.isValid를 읽을 때만 무효화를 알아채므로 빈 interval로 5초마다 검사하게 한다.
        // 업데이트 전에 열린 탭은 새로고침할 때까지 기능이 멈춘다.
        ctx.setInterval(() => {}, 5_000);

        // 옵션 페이지는 저장소에 직접 쓰고, 모듈 레지스트리가 저장소를 감시해 반영한다 (메시징 없음).

        mountOverlayWhenNeeded(ctx);

        warnWhenBlocked();

        // ===== 모듈 부트스트랩 =====
        // 차단·메모는 글 목록·본문(features의 urls와 같은 BOARD_PAGE)에서만 쓴다. 메인·검색 등에서는 저장소를 읽지 않는다.
        // 가장 큰 IP/밴 DB는 여기서 읽지 않는다. 유저 정보 모듈의 setup이 모듈 설정 뒤에 읽고, 모듈이 꺼져 있으면
        // 버블·미리보기가 IP 정보를 처음 그릴 때 읽는다 (core/database의 subscribeDatabase).
        const board = BOARD_PAGE.test(documentUrl.href);
        await loadAll(features, ctx.signal, board ? Promise.all([initBlocksStore(ctx.signal), initMemosStore(ctx.signal)]) : undefined);
    }
});
