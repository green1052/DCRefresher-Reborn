import type {BrowserContext, Page} from "@playwright/test";

/** 확장 페이지(옵션·팝업)는 크로미엄에서만 연다. 플레이라이트의 파이어폭스는 moz-extension:// 페이지로 이동하지 못한다. */
const extensionUrl = (extensionId: string, file: string): string => `chrome-extension://${extensionId}/${file}`;

type OptionsTab = "general" | "block" | "memo" | "data";

/** 옵션 페이지. 탭은 주소의 해시로 고른다. 탭은 저장소를 다 읽은 뒤에 그려진다. */
export async function openOptions(page: Page, extensionId: string, tab: OptionsTab) {
    const goto = async (next: OptionsTab): Promise<void> => {
        await page.goto(extensionUrl(extensionId, `options.html#${next}`));
    };
    await goto(tab);

    const cards = page.locator("[data-slot=card]");
    return {
        page,
        goto,
        cards,
        /** 모듈 카드 (제목으로 찾는다). */
        card: (name: string) => cards.filter({has: page.getByRole("heading", {name, exact: true})}),
        dialog: page.getByRole("dialog"),
        table: page.locator("table")
    };
}

/** 팝업 페이지. 팝업은 활성 탭을 보므로, 탭(tab)을 주면 그 탭을 앞으로 가져온 뒤 다시 읽어 그 탭에서 연 것처럼 만든다. */
export async function openPopup(context: BrowserContext, extensionId: string, tab?: Page) {
    const page = await context.newPage();
    const tiles = page.locator("button[aria-pressed]");
    await page.goto(extensionUrl(extensionId, "popup.html"));
    await tiles.first().waitFor();
    if (tab) {
        await tab.bringToFront();
        await page.reload();
        await tiles.first().waitFor();
    }

    return {
        page,
        tiles,
        /** 모듈 타일 (이름으로 찾는다). */
        tile: (name: string) => tiles.filter({hasText: name}),
        /** 현재 페이지 토글 스위치. */
        pageToggle: (name: string | RegExp) => page.getByRole("switch", {name})
    };
}
