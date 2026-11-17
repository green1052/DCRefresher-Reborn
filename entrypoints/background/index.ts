import {onMessage, sendMessage} from "@/core/messaging/protocol";
import {type BackgroundModule, startBackgroundModules} from "@/core/module/background";
import {CONTENT_EXCLUDE_MATCHES, CONTENT_MATCHES} from "@/core/pages";
import {dbMetaStorage} from "@/core/storage/items";
import {friendlyMessage} from "@/utils/error";

import {startAutoBackup} from "./backup";
import {fillMissingBlockIds} from "./blocks";
import {startDatabaseUpdates} from "./database";
import {listenPageMessages} from "./page";

/** 모듈별 배경 코드(features/<id>/background.ts). 필요한 모듈만 이 파일을 둔다. */
const backgroundModules = Object.values(import.meta.glob<{ default: BackgroundModule }>("../../features/*/background.ts", {eager: true}))
    .map((module) => module.default);

// 브라우저 내장 URLPattern을 써 wxt MatchPattern 번들을 피한다 - "*.dcinside.com"은 본 도메인도 맞으니 {*.}?로 선택으로 둔다.
const toUrlPattern = (pattern: string): URLPattern => new URLPattern(pattern.replace("//*.", "//{*.}?"));
const CONTENT = CONTENT_MATCHES.map(toUrlPattern);
const EXCLUDED = CONTENT_EXCLUDE_MATCHES.map(toUrlPattern);
const hasContentScript = (url: string): boolean =>
    CONTENT.some((pattern) => pattern.test(url)) && !EXCLUDED.some((pattern) => pattern.test(url));

// 크롬은 서비스 워커, 파이어폭스는 이벤트 페이지 - 언제든 멈추니 리스너는 동기로 걸고 상태는 저장소에 둔다.
export default defineBackground({type: "module", main: () => {
    // ===== 모듈의 배경 쪽 (이미지 검색 메뉴 등) =====
    // 크롬은 메뉴 같은 상태를 유지하므로 설치, 브라우저 시작, 설정 변경 때만 다시 맞춘다.
    const applyBackgroundModules = startBackgroundModules(backgroundModules);
    // 파이어폭스는 배경이 다시 뜰 때마다(시작 포함) 맞춘다 - onStartup도 여기서 덮으니 크롬만 건다.
    if (import.meta.env.BROWSER === "firefox") void applyBackgroundModules();
    else browser.runtime.onStartup.addListener(() => void applyBackgroundModules());

    // ===== Commands: 단축키 → 활성 탭에만 전송 =====
    // 단축키 기능은 '이번 페이지' 단위라 모든 탭에 보내면 탭마다 토글, 토스트, 목록 요청이 한꺼번에 일어난다.
    browser.commands.onCommand.addListener(async (command, tab) => {
        // tabs 권한이 없어 url은 디시 탭에서만 보인다 - 받는 쪽 없는 탭에 보내면 크롬이 "Unchecked runtime.lastError"를 남겨 먼저 거른다.
        if (!tab?.id || !tab.url || !hasContentScript(tab.url)) return;
        await sendMessage("refresher:executeShortcut", command, {tabId: tab.id}).catch(() => {});
    });

    listenPageMessages();

    const updateDatabase = startDatabaseUpdates();
    // 옵션의 "지금 갱신". ky 오류는 메시지로 건너가면 종류(상태 코드 등)를 잃으므로 여기서 안내 문구로 바꿔 던진다.
    onMessage("refresher:updateDatabase", () => updateDatabase(true).catch((e: unknown) => {
        console.error(e);
        throw new Error(friendlyMessage(e));
    }));

    browser.runtime.onInstalled.addListener(async () => {
        // 파이어폭스는 설치, 업데이트 때도 배경이 새로 떠 위에서 이미 맞췄다.
        if (import.meta.env.BROWSER !== "firefox") await applyBackgroundModules();
        await fillMissingBlockIds();

        // 개발 빌드는 DB가 없을 때만 받는다.
        if (import.meta.env.PROD || !(await dbMetaStorage().getValue()).version) {
            await updateDatabase();
        }
    });

    startAutoBackup();
}});
