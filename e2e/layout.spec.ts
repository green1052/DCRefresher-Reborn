import {expect, test} from "./fixtures";
import {managementPage} from "./pages/gallery";

test.describe("레이아웃", () => {
    test("컴팩트 모드에서도 갤러리 관리 페이지의 설정 칸을 숨기지 않는다", async ({page, storage}) => {
        await storage.setModuleSettings("layout", {forceCompact: true});
        await page.goto("https://gall.dcinside.com/mini/management/?id=test");

        await expect(page.locator("html")).toHaveClass(/refresherCompact/);
        await expect(managementPage(page).menu).toBeVisible();
        await expect(page.getByText("갤러리 이름")).toBeVisible();
    });
});
