import type {Page} from "@playwright/test";

export const LIST_URL = "https://gall.dcinside.com/board/lists/?id=test";

/** 콘텐츠 스크립트가 돈 가짜 글 목록 페이지 (e2e/dcinside.ts). 새로고침 버튼이 붙을 때까지 기다린다 */
export async function openListPage(page: Page) {
    await page.goto(LIST_URL);
    await page.waitForSelector("button[data-refresher-refresh]");

    return {
        page,
        rows: () => page.locator(".gall_list tbody tr"),
        badges: () => page.locator(".refresher-user-badges"),
        refreshButton: () => page.locator("button[data-refresher-refresh]"),
        /** 오버레이 shadow root. 처음 필요할 때 붙는다 */
        overlay: () => overlay(page)
    };
}

export type ListPage = Awaited<ReturnType<typeof openListPage>>;

export const overlay = (page: Page) => page.locator("refresher-root");
