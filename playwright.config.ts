import {defineConfig} from "@playwright/test";

/**
 * E2E 테스트 (bun run test:e2e). 빌드한 확장(.output/chrome-mv3)을 크로미엄에 올려 옵션·팝업·콘텐츠 스크립트를 실제로 돌린다.
 * 디시에는 요청을 보내지 않는다. tests/e2e/fixtures.ts가 dcinside.com 주소를 가짜 페이지로 응답한다.
 * 테스트마다 확장을 새로 올린 브라우저 컨텍스트를 쓰므로 한 번에 하나씩 돈다
 */
export default defineConfig({
    testDir: "tests/e2e",
    timeout: 60_000,
    // test.only를 두고 올리면 CI가 실패한다
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    workers: 1,
    reporter: process.env.CI ? [["list"], ["html", {open: "never"}]] : "list",
    use: {
        trace: "on-first-retry",
        viewport: {width: 1280, height: 900}
    },
    projects: [{name: "chromium"}]
});
