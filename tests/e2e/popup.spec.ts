import {expect, storedIn, test} from "./fixtures";

test.describe("팝업", () => {
    test("모듈 타일을 그리고 누르면 켜고 끈다", async ({context, extensionId, errors: _errors}) => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/popup.html`);

        const tiles = page.locator(".module-tile");
        await expect(tiles.first()).toBeVisible();
        expect(await tiles.count()).toBeGreaterThanOrEqual(10);
        await expect(page.getByText("디시인사이드 갤러리에서 열면")).toBeVisible();

        const manage = tiles.filter({hasText: "관리"});
        await expect(manage).toHaveAttribute("aria-pressed", "false");
        await manage.click();
        await expect(manage).toHaveAttribute("aria-pressed", "true");
        await expect.poll(() => storedIn(page, "refresher:modules")).toEqual({manage: true});
    });

    test("디시 탭에서 열면 현재 페이지 토글이 나오고 탭의 모듈을 바로 조작한다", async ({context, extensionId, listPage}) => {
        const popup = await context.newPage();
        await popup.goto(`chrome-extension://${extensionId}/popup.html`);
        // 팝업은 활성 탭을 본다. 마지막으로 연 팝업 탭이 아니라 목록 탭이 활성이어야 한다
        await listPage.bringToFront();
        await popup.reload();

        await expect(popup.getByText("현재 페이지")).toBeVisible();
        const pause = popup.getByRole("switch", {name: /자동 새로고침 일시정지/});
        await expect(pause).not.toBeChecked();
        await pause.click();
        await expect(pause).toBeChecked();
        await expect(listPage.locator("button[data-refresher-refresh]")).toHaveText("자동 새로고침: 꺼짐");
    });
});
