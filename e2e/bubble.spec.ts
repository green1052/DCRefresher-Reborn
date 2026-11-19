import {type Page} from "@playwright/test";

import {DCCON, fakeComment} from "./dcinside";
import {expect, test} from "./fixtures";

// 버블은 fixed z-50이라 native 모달 창(top layer) 뒤로 순는다 - 모달이 열려 있으면 그 안에 그려야 한다.
const paintedTopmost = (page: Page): Promise<boolean> =>
    page.evaluate(() => {
        const root = document.querySelector("refresher-root");
        const bubble = root?.shadowRoot?.querySelector("[data-slot=popover-content]");
        if (!bubble) return false;
        const r = bubble.getBoundingClientRect();
        const hit = root?.shadowRoot?.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 30));
        return Boolean(hit && hit.closest("[data-slot=popover-content]") === bubble);
    });

test("미리보기에서 버블은 프레임 위에, 모달 창이 열려 있으면 그 안에 뜬다", async ({listPage, site}) => {
    site.comments = [fakeComment(20, {memo: `<img class="written_dccon" src="${DCCON.list_img}" alt="${DCCON.title}">`})];
    const {page} = listPage;
    await listPage.openPreview();
    await expect(listPage.frameTitle).toHaveText("[말머리] 글 3 제목");

    const bubble = listPage.overlay.locator("[data-slot=popover-content]");

    // 프레임 안 작성자를 우클릭하면 버블이 프레임보다 위에 그려진다.
    await expect(async () => {
        await page.locator(".refresher-user button").first().click({button: "right"});
        await expect(bubble).toBeVisible({timeout: 500});
    }).toPass();
    await expect.poll(() => paintedTopmost(page)).toBe(true);
    await page.keyboard.press("Escape");
    await expect(bubble).toHaveCount(0);

    // 디시콘 정보 창(native 모달)을 열고 그 안의 디시콘을 우클릭하면 버블이 창 위에 뜬다.
    const info = listPage.overlay.getByRole("dialog", {name: "디시콘 정보"});
    await expect(async () => {
        await page.locator("img.written_dccon").first().click();
        await expect(info).toBeVisible({timeout: 500});
    }).toPass();

    await expect(async () => {
        await info.locator("img.cursor-context-menu").first().click({button: "right"});
        await expect(bubble).toBeVisible({timeout: 500});
    }).toPass();
    await expect.poll(() => paintedTopmost(page)).toBe(true);

    // Esc는 모달 창을 남기고 버블만 닫는다.
    await page.keyboard.press("Escape");
    await expect(bubble).toHaveCount(0);
    await expect(info).toBeVisible();
});
