import type {BrowserContext, Page} from "@playwright/test";

import {extensionUrl} from "./extension";

/** 팝업 페이지. 모듈 타일과 (디시 탭에서 열면) 현재 페이지 토글을 다룬다. */
export async function openPopup(page: Page, extensionId: string) {
    await page.goto(extensionUrl(extensionId, "popup.html"));
    await page.locator(".module-tile").first().waitFor();

    const popup = {
        page,
        tiles: () => page.locator(".module-tile"),
        tile: (name: string) => popup.tiles().filter({hasText: name}),
        /** 현재 페이지 토글 스위치. */
        pageToggle: (name: RegExp) => page.getByRole("switch", {name}),
        /** 팝업은 활성 탭을 본다. 다른 탭을 앞으로 가져온 뒤 다시 읽는다. */
        reload: async () => {
            await page.reload();
            await page.locator(".module-tile").first().waitFor();
        }
    };
    return popup;
}

/** 탭(page)에서 연 것처럼 팝업을 연다. 팝업은 활성 탭을 보므로, 팝업 탭을 연 뒤 그 탭을 앞으로 가져와 다시 읽는다. */
export async function openPopupFor(context: BrowserContext, extensionId: string, tab: Page) {
    const popup = await openPopup(await context.newPage(), extensionId);
    await tab.bringToFront();
    await popup.reload();
    return popup;
}
