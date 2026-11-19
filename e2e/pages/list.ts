import {expect, type Locator, type Page} from "@playwright/test";

const FAKE_LIST_URL = "https://gall.dcinside.com/board/lists/?id=test";

/** 콘텐츠 스크립트가 단 목록 페이지. 미리보기 창(preact)이 비동기로 그려지므로 창 안 것들은 frame()에서 찾는다. */
export async function openListPage(page: Page, url = FAKE_LIST_URL) {
    await page.goto(url);
    await page.locator("button[data-refresher-refresh]").waitFor();

    // 오버레이(shadow root). 처음 그릴 것이 생길 때 붙는다. 플레이라이트의 CSS 선택자는 열린 shadow root 안까지 찾는다.
    const overlay = page.locator("refresher-root");
    const titles = page.locator(".gall_list .ub-word");
    const frame = overlay.locator(".refresher-frame");
    const rows = page.locator(".gall_list tbody tr");
    const row = (no: number | string): Locator => page.locator(`.gall_list tbody tr[data-no="${no}"]`);

    return {
        page,
        overlay,
        rows,
        row,
        writer: (no: number | string): Locator => row(no).locator(".ub-writer"),
        checkedNumbers: rows.filter({has: page.getByRole("checkbox", {checked: true})}).locator(".gall_num"),
        titles,
        replyCounts: page.locator(".gall_list .reply_numbox"),
        writers: page.locator(".gall_list .ub-writer"),
        badges: page.locator(".refresher-user-badges"),
        refreshButton: page.locator("button[data-refresher-refresh]"),
        paging: page.locator(".bottom_paging_box"),
        frame,
        frameTitle: frame.getByRole("heading", {level: 2}),
        comments: frame.locator(".refresher-comment"),
        mini: overlay.locator(".refresher-mini-preview"),
        bubble: overlay.locator("[data-slot=popover-content]"),
        dialog: overlay.locator("[data-slot=dialog-content]"),
        alert: overlay.locator("[data-slot=alert-dialog-content]"),
        toast: overlay.locator("[data-slot=toast]"),
        openPreview: async (index = 0): Promise<Locator> => {
            await titles.nth(index).click({button: "right"});
            return frame;
        },
        closePreview: async (): Promise<void> => {
            await page.keyboard.press("Escape");
            await expect(frame).toHaveCount(0);
        },
        leave: () => page.mouse.move(0, 0)
    };
}

export type ListPage = Awaited<ReturnType<typeof openListPage>>;
