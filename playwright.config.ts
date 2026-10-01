import {defineConfig, devices} from "@playwright/test";

/**
 * E2E 테스트. 빌드한 확장을 브라우저에 올려 옵션·팝업·콘텐츠 스크립트를 실제로 돌린다.
 * bun run e2e는 크로미엄(.output/chrome-mv3), bun run e2e:firefox는 파이어폭스(.output/firefox-mv2)다.
 * WXT의 Playwright 예제(wxt-dev/examples의 playwright-e2e-testing)와 같은 구성이다: e2e/fixtures.ts가 확장을 올리고, e2e/pages/가 페이지별 조작을 모은다.
 * 디시에는 요청을 보내지 않는다. e2e/fixtures.ts가 dcinside.com 주소를 가짜 페이지로 응답한다.
 * 테스트마다 확장을 새로 올린 브라우저 컨텍스트를 쓰므로 한 번에 하나씩 돈다
 */
export default defineConfig({
    testDir: "e2e",
    timeout: 60_000,
    // test.only를 두고 올리면 CI가 실패한다
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    workers: 1,
    reporter: process.env.CI ? [["list"], ["html", {open: "never"}]] : "list",
    use: {
        trace: "on-first-retry"
    },
    projects: [
        {
            name: "chromium",
            use: {...devices["Desktop Chrome"], viewport: {width: 1280, height: 900}}
        },
        // bun run build:firefox로 빌드한 .output/firefox-mv2를 올린다 (e2e/firefox.ts). bunx playwright install firefox가 필요하다
        {
            name: "firefox",
            use: {...devices["Desktop Firefox"], viewport: {width: 1280, height: 900}}
        }
    ]
});
