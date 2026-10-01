import {expect, storedIn, test} from "./fixtures";
import {openPopup} from "./pages/popup";

test.describe("팝업", () => {
    test("모듈 타일을 그리고 누르면 켜고 끈다", async ({page, extensionId, errors: _errors}) => {
        const popup = await openPopup(page, extensionId);

        expect(await popup.tiles().count()).toBeGreaterThanOrEqual(10);
        await expect(page.getByText("디시인사이드 갤러리에서 열면")).toBeVisible();

        const manage = popup.tile("관리");
        await expect(manage).toHaveAttribute("aria-pressed", "false");
        await manage.click();
        await expect(manage).toHaveAttribute("aria-pressed", "true");
        await expect.poll(() => storedIn(page, "refresher:modules")).toEqual({manage: true});
    });

    test("디시 탭에서 열면 현재 페이지 토글이 나오고 탭의 모듈을 바로 조작한다", async ({context, extensionId, listPage}) => {
        const popup = await openPopup(await context.newPage(), extensionId);
        // 팝업은 활성 탭을 본다. 마지막으로 연 팝업 탭이 아니라 목록 탭이 활성이어야 한다
        await listPage.page.bringToFront();
        await popup.reload();

        await expect(popup.page.getByText("현재 페이지")).toBeVisible();
        const pause = popup.pageToggle(/자동 새로고침 일시정지/);
        await expect(pause).not.toBeChecked();
        await pause.click();
        await expect(pause).toBeChecked();
        await expect(listPage.refreshButton()).toHaveText("자동 새로고침: 꺼짐");
    });

    test("모듈을 끄고 켜면 현재 페이지 토글이 저장된 상태를 따라간다", async ({context, extensionId, listPage}) => {
        const popup = await openPopup(await context.newPage(), extensionId);
        await listPage.page.bringToFront();
        await popup.reload();

        const pause = popup.pageToggle(/자동 새로고침 일시정지/);
        await expect(pause).toBeVisible();

        // 탭이 모듈을 멈춘 뒤의 상태로 답해야 토글이 사라진다
        await popup.tile("글 목록 새로고침").click();
        await expect(pause).toHaveCount(0);
        await expect(listPage.refreshButton()).toHaveCount(0);

        await popup.tile("글 목록 새로고침").click();
        await expect(pause).toBeVisible();
        await expect(listPage.refreshButton()).toHaveCount(1);
    });
});
