import {defineConfig, devices} from "@playwright/test";

/**
 * E2E 테스트. 빌드한 확장(bun run e2e는 .output/chrome-mv3, e2e:firefox는 .output/firefox-mv2)을 브라우저에 올려 돌린다.
 * e2e/fixtures.ts가 확장을 올리고 dcinside.com 주소를 가짜 페이지로 응답한다. e2e/pages/는 페이지별 조작을 모은다.
 * e2e:live(e2e/live/)만 실제 디시에 읽기 요청을 보내 마크업·API 변화를 본다. 쓰기 요청은 픽스처가 끊는다.
 * 테스트마다 확장을 새로 올린 브라우저 컨텍스트를 쓰므로 한 번에 하나씩 돈다.
 */
export default defineConfig<{ live: boolean }>({
    testDir: "e2e",
    timeout: 60_000,
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
            testIgnore: "live/**",
            use: {...devices["Desktop Chrome"], viewport: {width: 1280, height: 900}}
        },
        // bun run e2e:firefox가 빌드한 .output/firefox-mv2를 올린다 (e2e/firefox.ts). bunx playwright install firefox가 필요하다.
        // 플레이라이트의 파이어폭스는 moz-extension:// 페이지로 이동하지 못해(page.goto가 끝나지 않는다) 팝업·옵션 테스트는 뺀다.
        {
            name: "firefox",
            testIgnore: ["live/**", "popup.spec.ts", "options.spec.ts"],
            use: {...devices["Desktop Firefox"], viewport: {width: 1280, height: 900}}
        },
        // 실제 디시. 네트워크·디시 상태에 따라 흔들릴 수 있어 한 번 더 돌린다. 갤러리는 미니 갤러리 bjwg64다.
        {
            name: "live",
            testMatch: "live/**/*.spec.ts",
            retries: 1,
            use: {...devices["Desktop Chrome"], viewport: {width: 1280, height: 900}, live: true}
        }
    ]
});
