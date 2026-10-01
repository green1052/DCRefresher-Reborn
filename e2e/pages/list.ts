import type {Page} from "@playwright/test";

export const LIST_URL = "https://gall.dcinside.com/board/lists/?id=test";

/** 오버레이 shadow root. 처음 필요할 때 붙는다 */
export const overlay = (page: Page) => page.locator("refresher-root");

/**
 * 콘텐츠 스크립트가 돈 가짜 글 목록 페이지 (e2e/dcinside.ts). 새로고침 버튼이 붙을 때까지 기다린다.
 * 첫 행은 글 3(고닉 user3, 댓글 2개)이다
 */
export async function openListPage(page: Page) {
    await page.goto(LIST_URL);
    await page.waitForSelector("button[data-refresher-refresh]");

    const inOverlay = (selector: string) => overlay(page).locator(selector);

    return {
        page,
        rows: () => page.locator(".gall_list tbody tr"),
        /** 제목 칸 (미리보기·미니 미리보기를 연다) */
        titles: () => page.locator(".gall_list .ub-word"),
        /** 댓글 수 링크 (댓글만 보기) */
        replyCounts: () => page.locator(".gall_list .reply_numbox"),
        /** 작성자 칸 (유저 버블) */
        writers: () => page.locator(".gall_list .ub-writer"),
        badges: () => page.locator(".refresher-user-badges"),
        refreshButton: () => page.locator("button[data-refresher-refresh]"),
        overlay: () => overlay(page),
        /** 미리보기 창 */
        frame: () => inOverlay(".refresher-frame"),
        /** 미니 미리보기 카드 */
        mini: () => inOverlay(".refresher-mini-preview"),
        /** 유저 버블 */
        bubble: () => inOverlay(".rt-PopoverContent"),
        toast: () => inOverlay(".refresher-toast"),
        /** 커서를 목록 밖으로 뺀다 (미니 미리보기 닫기) */
        leave: () => page.mouse.move(0, 0)
    };
}

export type ListPage = Awaited<ReturnType<typeof openListPage>>;
