import type {Page} from "@playwright/test";

import {extensionUrl} from "./extension";

/** 팝업 페이지. 모듈 타일과 (디시 탭에서 열면) 현재 페이지 토글을 다룬다 */
export async function openPopup(page: Page, extensionId: string) {
    await page.goto(extensionUrl(extensionId, "popup.html"));
    await page.locator(".module-tile").first().waitFor();

    const popup = {
        page,
        tiles: () => page.locator(".module-tile"),
        tile: (name: string) => popup.tiles().filter({hasText: name}),
        /** 현재 페이지 토글 스위치 */
        pageToggle: (name: RegExp) => page.getByRole("switch", {name}),
        /** 팝업은 활성 탭을 본다. 다른 탭을 앞으로 가져온 뒤 다시 읽는다 */
        reload: async () => {
            await page.reload();
            await page.locator(".module-tile").first().waitFor();
        }
    };
    return popup;
}
