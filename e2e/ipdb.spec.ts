import {expect, test} from "./fixtures";
import {openOptions} from "./pages/extension";

// 배경이 가짜 IP DB를 받아 저장하고, 페이지가 그것을 읽어 배지를 붙이는 흐름.
// 파이어폭스는 배경 요청을 route로 가로채지 못해(OFFLINE_PREFS) 크로미엄에서만 돈다.
test.describe("IP/밴 데이터베이스", () => {
    test.use({serveIpDb: true});
    test.skip(({browserName}) => browserName === "firefox", "파이어폭스는 배경의 IP DB 요청을 가로채지 못한다.");

    test("설치 때 받은 IP DB로 유동 행에 통신사 배지를, 갱차 조회를 켜면 밴 배지를 붙인다", async ({listPage, ipDb, storage}) => {
        await expect(listPage.row(2).locator(".refresher-user-badges")).toHaveText(`[${ipDb.org}]`);

        await storage.setModuleSettings("userinfo", {checkPermBan: true});
        await expect(listPage.row(1).locator(".refresher-user-badges")).toHaveText("(user1)[테스트 갤러리]");
    });

    test("지금 갱신은 버전이 같아도 다시 받는다", async ({page, extensionId, ipDb, storage}) => {
        const ipRequests = (): number => ipDb.requests.filter((path) => path === "/ip.json").length;
        await expect.poll(() => storage.get("refresher:db:meta")).toMatchObject({version: ipDb.version});
        expect(ipRequests()).toBe(1);

        const {toasts} = await openOptions(page, extensionId, "data");
        await expect(page.getByText(`버전: ${ipDb.version}`)).toBeVisible();
        await page.getByRole("button", {name: "지금 갱신", exact: true}).click();
        await expect(toasts).toContainText("데이터베이스를 갱신했습니다.");
        expect(ipRequests()).toBe(2);
    });
});
