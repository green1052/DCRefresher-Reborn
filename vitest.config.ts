import {defineConfig} from "vitest/config";
import {WxtVitest} from "wxt/testing/vitest-plugin";

/**
 * 단위 테스트 모음 (bun run test). WxtVitest가 wxt.config.ts의 vite 설정·@/ 별칭·import.meta.env.BROWSER 같은 환경을 맞춰 주고
 * 확장 API(browser.*)를 @webext-core/fake-browser(메모리 storage 등)로 바꾼다. E2E는 playwright.config.ts를 본다.
 */
export default defineConfig({
    plugins: [WxtVitest()],
    test: {
        include: ["tests/unit/**/*.test.{ts,tsx}"],
        // 파서·대화·목록 교체처럼 DOM을 만지는 코드가 많아 jsdom을 기본으로 쓴다.
        environment: "jsdom",
        // 파일마다 워커를 다시 띄우지 않고 vm 컨텍스트만 새로 만들어 jsdom 준비가 빠르다 (4.6초→2.6초).
        // 다만 Node 내장 모듈(fs 등 얼개 류)은 realm이 달라 instanceof Error가 아닐 수 있다. 그런 패턴이 생기면 이 줄을 지운다.
        pool: "vmThreads",
        setupFiles: ["tests/setup.ts"],
        mockReset: true,
        restoreMocks: true
    }
});
