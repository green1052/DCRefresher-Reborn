import {storage} from "wxt/utils/storage";

import {http} from "@/core/http/client";
import {postSearchUrl} from "@/core/http/urls";
import {onMessage, sendMessage} from "@/core/messaging/protocol";
import {type BackgroundModule, startBackgroundModules} from "@/core/module/background";
import {dbStorage, moduleDataKey} from "@/core/storage/items";
import {recordUsage, syncUsage} from "@/core/usage";

import {startAutoBackup} from "./backup";
import {startDatabaseUpdates} from "./database";
import {listenPageMessages} from "./page";

/** 모듈별 배경 코드(features/<id>/background.ts). 필요한 모듈만 이 파일을 둔다. */
const backgroundModules = Object.values(import.meta.glob<{ default: BackgroundModule }>("../../features/*/background.ts", {eager: true}))
    .map((module) => module.default);

/**
 * 배경 스크립트. 서비스 워커(크롬)는 언제든 멈췄다 다시 뜨므로 리스너는 모두 여기서 동기로 걸고, 상태는 저장소에 둔다.
 * - page.ts: 콘텐츠 스크립트 대신 탭의 페이지(MAIN world)에서 실행하는 것 (reCAPTCHA, 목록 스크립트)
 * - database.ts: IP·밴 DB 주기 갱신
 * - backup.ts: 자동 클라우드 백업.
 */
export default defineBackground(() => {
    // ===== 모듈의 배경 쪽 (이미지 검색 메뉴 등) =====
    // 리스너는 여기서 바로 건다. 크롬은 메뉴 같은 상태를 유지하므로 설치·브라우저 시작·설정 변경 때만 다시 맞춘다.
    const applyBackgroundModules = startBackgroundModules(backgroundModules);
    // 파이어폭스(MV2)는 메뉴를 유지하지 않고, 확장을 껐다 켜면 onStartup/onInstalled 없이 배경만 다시 뜨므로 뜰 때마다 맞춘다.
    // 브라우저 시작도 여기서 맞추므로 onStartup은 크롬만 건다 (둘 다 걸면 시작할 때 두 번 돈다).
    if (import.meta.env.BROWSER === "firefox") void applyBackgroundModules();
    else browser.runtime.onStartup.addListener(() => void applyBackgroundModules());

    // ===== Commands: 단축키 → 활성 탭에만 전송 =====
    // 단축키 기능은 '이번 페이지' 단위라 모든 탭에 보내면 탭마다 토글·토스트·목록 요청이 한꺼번에 일어난다.
    browser.commands.onCommand.addListener(async (command, tab) => {
        // 활성 탭이 디시가 아니면 받는 쪽이 없어 실패한다.
        if (tab?.id) await sendMessage("refresher:executeShortcut", command, {tabId: tab.id}).catch(() => {});
    });

    listenPageMessages();

    // ===== 관리: 같은 제목 글 찾기의 통합검색 (CORS를 열지 않아 콘텐츠 스크립트가 직접 받지 못한다) =====
    onMessage("refresher:searchPosts", ({data: query}) => http.get(postSearchUrl(query)).text());

    // ===== 차단·메모 사용 기록 (core/usage). 탭·옵션이 따로 쓰면 서로 덮으므로 여기서 차례로 쓴다 =====
    onMessage("refresher:markUsed", ({data}) => recordUsage(data));
    onMessage("refresher:syncUsage", ({data: {kind, ids}}) => syncUsage(kind, ids));

    const updateDatabase = startDatabaseUpdates();

    browser.runtime.onInstalled.addListener(async () => {
        await applyBackgroundModules();
        // 미리보기로 읽은 글 기록. 이제 브라우저 방문 기록(:visited)으로 표시해 쓰지 않는다.
        await storage.removeItem(moduleDataKey("preview"));

        // 개발 빌드는 DB가 없을 때만 받는다.
        if (import.meta.env.PROD || !(await dbStorage.meta.getValue()).version) {
            await updateDatabase();
        }
    });

    startAutoBackup();
});
