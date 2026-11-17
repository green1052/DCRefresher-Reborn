import type {ContentScriptContext} from "wxt/utils/content-script-context";

import {releaseDatabase} from "@/core/database";
import {documentUrl} from "@/core/http/urls";
import {onMessage} from "@/core/messaging/protocol";
import {loadAll, pageState, runPageToggle, runShortcut, settledPageState, stopAll} from "@/core/module/registry";
import {enablesOf, isModuleEnabled} from "@/core/module/settings";
import {BOARD_PAGE} from "@/core/pages";
import {MODULES_KEY} from "@/core/storage/items";
import {bindUsageContext} from "@/core/usage";
import features from "@/features";
import metas from "@/features/metas";
import {initBlocksStore} from "@/stores/blocks";
import {initMemosStore} from "@/stores/memos";

import {storage} from "wxt/utils/storage";

import {mountOverlayWhenNeeded} from "./overlay";

// 부트스트랩(index.ts)이 청크로 나눠 부르므로 export로만 낸다.
export const start = async (ctx: ContentScriptContext): Promise<void> => {
    bindUsageContext(ctx.signal);

    // ===== 메시징 (배경, 팝업→탭) =====
    // 스크립트가 다시 주입되면 이전 인스턴스가 남아 메시지를 계속 받는다. 멈춘 모듈의 빈 상태로 팝업에 먼저 답하지 않게 무효화될 때 푼다.
    ctx.onInvalidated(onMessage("refresher:executeShortcut", ({data: command}) => runShortcut(command)));

    ctx.onInvalidated(onMessage("refresher:pageState", settledPageState));
    ctx.onInvalidated(onMessage("refresher:pageAction", ({data: action}) => {
        runPageToggle(action);
        return pageState();
    }));

    // 확장이 꺼져도 스크립트는 남아 실패하므로 무효화 때 모듈을 멈춘다 - 저장소 읽기 중 무효화돼도 뒤 등록에 가게 먼저 건다.
    ctx.onInvalidated(() => {
        stopAll();
        releaseDatabase();
    });
    // WXT는 ctx.isValid를 읽을 때만 무효화를 알아채므로 빈 interval로 5초마다 검사하게 한다.
    ctx.setInterval(() => {}, 5_000);

    // 옵션 페이지는 저장소에 직접 쓰고, 모듈 레지스트리가 저장소를 감시해 반영한다 (메시징 없음).

    mountOverlayWhenNeeded(ctx);

    // ===== 모듈 부트스트랩 =====
    // 차단, 메모 저장소는 BOARD_PAGE에서만, 읽는 모듈이 하나라도 켜져 있을 때만 읽는다. 스킵한 회차는 다음 기회에 다시 본다.
    const STORE_USERS = ["block", "preview", "userinfo"];
    let storesReady: Promise<void> | undefined;
    const ensureStores = (): Promise<void> => storesReady ??= (async () => {
        const enables = enablesOf(await storage.getItem(MODULES_KEY));
        const needed = metas.filter((meta) => STORE_USERS.includes(meta.id)).some((meta) => isModuleEnabled(meta, enables));
        if (!needed) {
            storesReady = undefined;
            return;
        }
        await Promise.all([initBlocksStore(ctx.signal), initMemosStore(ctx.signal)]);
    })();
    const board = BOARD_PAGE.test(documentUrl.pathname);
    await loadAll(features, ctx.signal, board ? ensureStores : undefined);
};

// HTML 엔트리는 이 모듈을 부수 효과만으로 읽어 export가 트리쉐이킹되므로 전역에 심는다.
(globalThis as Record<string, unknown>)["__refresherContentStart"] = start;
