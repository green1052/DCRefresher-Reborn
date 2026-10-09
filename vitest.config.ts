import preact from "@preact/preset-vite";
import {defineConfig} from "vitest/config";
import {WxtVitest} from "wxt/testing/vitest-plugin";

/**
 * 단위 테스트 (bun run test). WxtVitest가 wxt.config.ts의 vite 설정·@/ 별칭·import.meta.env.BROWSER 같은 전역을 맞추고,
 * 확장 API(browser.*)를 @webext-core/fake-browser(인메모리 storage 등)로 바꾼다. E2E는 playwright.config.ts다.
 */
export default defineConfig({
    // WxtVitest는 wxt.config.ts의 vite 플러그인을 불러오지 않는다. 빌드처럼 react를 preact/compat으로 바꿔야 컴포넌트 테스트가 진짜 React로 돌지 않는다.
    plugins: [WxtVitest(), preact({prefreshEnabled: false, devToolsEnabled: false})],
    test: {
        include: ["tests/unit/**/*.test.{ts,tsx}"],
        // 파서·정화·목록 교체처럼 DOM을 만지는 코드가 많아 jsdom을 기본으로 둔다.
        environment: "jsdom",
        // 파일마다 워커를 새로 띄우지 않고 vm 컨텍스트만 새로 만들어 jsdom 준비가 빠르다 (4.6초 → 2.6초).
        // 대신 Node 내장 모듈(fs 등)이 던진 오류는 realm이 달라 instanceof Error가 어긋난다. 그런 실패가 나면 이 줄을 지운다.
        pool: "vmThreads",
        setupFiles: ["tests/setup.ts"],
        // zustand의 React 훅은 node_modules라 변환되지 않으면 진짜 react를 불러 훅이 깨진다. preact/compat으로 바꾸도록 같이 변환한다.
        server: {deps: {inline: ["zustand"]}},
        mockReset: true,
        restoreMocks: true
    }
});
