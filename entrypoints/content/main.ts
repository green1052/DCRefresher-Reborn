import type {ContentScriptContext} from "wxt/utils/content-script-context";

import {releaseDatabase} from "@/core/database";
import {documentUrl} from "@/core/http/urls";
import {onMessage} from "@/core/messaging/protocol";
import {loadAll, pageState, runPageToggle, runShortcut, settledPageState, stopAll} from "@/core/module/registry";
import {BOARD_PAGE} from "@/core/pages";
import {bindUsageContext} from "@/core/usage";
import features from "@/features";
import {initBlocksStore} from "@/stores/blocks";
import {initMemosStore} from "@/stores/memos";
import {copyWithToast, useUiStore} from "@/stores/ui";

import {warnWhenBlocked} from "./blocked";
import {showInvalidatedNote} from "./invalidated";
import {mountOverlayWhenNeeded} from "./overlay";
import {cleanUpStaleInstance, overlayDraft} from "./stale";

/**
 * 콘텐츠 스크립트 본문. index.tsx(부트스트랩)가 청크(chunks/content-main.js)로 나눠 부르므로 export로만 낸다.
 * 같은 폴더의 파일이 하나씩 맡는다:
 * - stale.ts: 파이어폭스 재주입으로 죽은 인스턴스가 남긴 것 걷어 내기
 * - invalidated.ts: 확장이 업데이트되거나 꺼졌을 때의 안내
 * - overlay.tsx: 오버레이(shadow DOM)를 처음 필요할 때 띄우기
 * - blocked.ts: 디시 임시 차단 안내.
 */
export const start = async (ctx: ContentScriptContext): Promise<void> => {
    const staleDraft = cleanUpStaleInstance();
    bindUsageContext(ctx.signal);

    // ===== 메시징 (배경·팝업→탭) =====
    // 스크립트가 다시 주입되면 이전 인스턴스가 남아 메시지를 계속 받는다. 멈춘 모듈의 빈 상태로 팝업에 먼저 답하지 않게 무효화될 때 푼다.
    ctx.onInvalidated(onMessage("refresher:executeShortcut", ({data: command}) => runShortcut(command)));

    ctx.onInvalidated(onMessage("refresher:pageState", settledPageState));
    ctx.onInvalidated(onMessage("refresher:pageAction", ({data: action}) => {
        runPageToggle(action);
        return pageState();
    }));

    // 확장을 끄거나 업데이트해도 이 스크립트는 남아 새로고침 폴링·저장소 호출을 하다 실패하므로 모듈을 멈춘다.
    // 부트스트랩의 await보다 먼저 등록한다. 저장소를 읽는 중에 무효화되면 그 호출이 실패하거나 끝나지 않아 await 뒤의 등록까지 가지 못한다.
    ctx.onInvalidated(() => {
        // WXT가 이 처리기 뒤에 오버레이를 걷어 내므로 입력하던 글을 먼저 읽어 둔다.
        const draft = overlayDraft(document.querySelector("refresher-root"));
        stopAll();
        releaseDatabase();
        // 새 스크립트가 주입되어 무효화된 경우(확장은 살아 있음)는 새 스크립트가 이어서 돌므로 알리지 않는다.
        if (browser.runtime?.id) return;
        showInvalidatedNote(draft);
    });
    // WXT는 ctx.isValid를 읽을 때만 무효화를 알아채므로 빈 interval로 5초마다 검사하게 한다.
    ctx.setInterval(() => {}, 5_000);

    // 옵션 페이지는 저장소에 직접 쓰고, 모듈 레지스트리가 저장소를 감시해 반영한다 (메시징 없음).

    mountOverlayWhenNeeded(ctx);
    // 오버레이 감시(mountOverlayWhenNeeded)가 생긴 뒤에 띄워야 토스트가 뜬다.
    // 다시 켜기·다시 불러오기로도 재주입되므로 '업데이트'라 하지 않는다.
    if (staleDraft) {
        useUiStore.getState().showToast("확장 프로그램이 다시 시작되어 열려 있던 창을 닫았습니다.", "warning", 0, {
            label: "입력하던 글 복사",
            run: () => void copyWithToast(staleDraft)
        });
    }

    warnWhenBlocked();

    // ===== 모듈 부트스트랩 =====
    // 차단·메모는 글 목록·본문(BOARD_PAGE)에서만 읽는다.
    // 가장 큰 IP/밴 DB는 여기서 읽지 않는다. 필요할 때 유저 정보 모듈(needsDatabase)이나 버블이 처음 그릴 때 읽는다 (core/database의 subscribeDatabase).
    const board = BOARD_PAGE.test(documentUrl.pathname);
    await loadAll(features, ctx.signal, board ? Promise.all([initBlocksStore(ctx.signal), initMemosStore(ctx.signal)]) : undefined);
};

// 이 청크를 만드는 HTML 엔트리는 이 모듈을 부수 효과만으로 읽어, export로만 닿는 start와 이 아래 전부가
// 트리셰이킹된다. 부트스트랩(entrypoints/content/index.tsx)이 런타임에 찾을 수 있게 격리 세계 전역에 심는다.
(globalThis as Record<string, unknown>)["__refresherContentStart"] = start;
