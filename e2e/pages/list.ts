import type {Locator, Page} from "@playwright/test";

const FAKE_LIST_URL = "https://gall.dcinside.com/board/lists/?id=test";

/**
 * 콘텐츠 스크립트가 돈 글 목록 페이지. 새로고침 버튼이 붙을 때까지 기다린다.
 * 기본은 가짜 디시(e2e/dcinside.ts)의 목록이고, url을 주면 그 주소를 연다 (live의 실제 디시).
 * 미리보기 창(Preact)은 비동기로 그려지므로 창 안의 것은 frame()에서 찾는다.
 */
export async function openListPage(page: Page, url = FAKE_LIST_URL) {
    await page.goto(url);
    await page.locator("button[data-refresher-refresh]").waitFor();

    // 오버레이(shadow root). 처음 그릴 것이 생길 때 붙는다. 플레이라이트의 CSS 선택자는 열린 shadow root 안까지 찾는다.
    const overlay = page.locator("refresher-root");
    const titles = page.locator(".gall_list .ub-word");
    const frame = overlay.locator(".refresher-frame");

    return {
        page,
        overlay,
        rows: page.locator(".gall_list tbody tr"),
        /** 글 번호로 찾은 행. */
        row: (no: number | string): Locator => page.locator(`.gall_list tbody tr[data-no="${no}"]`),
        /** 제목 칸 (우클릭은 미리보기, 마우스를 올리면 미니 미리보기). */
        titles,
        /** 댓글 수 링크 (댓글만 보기). */
        replyCounts: page.locator(".gall_list .reply_numbox"),
        /** 작성자 칸 (우클릭은 유저 버블). */
        writers: page.locator(".gall_list .ub-writer"),
        badges: page.locator(".refresher-user-badges"),
        refreshButton: page.locator("button[data-refresher-refresh]"),
        paging: page.locator(".bottom_paging_box"),
        /** 미리보기 창. */
        frame,
        /** 미리보기 창의 글 제목. */
        frameTitle: frame.getByRole("heading", {level: 2}),
        comments: frame.locator(".refresher-comment"),
        /** 미니 미리보기 카드. */
        mini: overlay.locator(".refresher-mini-preview"),
        bubble: overlay.locator("[data-slot=popover-content]"),
        /** 오버레이의 다이얼로그 (메모·디시콘 등). */
        dialog: overlay.locator("[data-slot=dialog-content]"),
        toast: overlay.locator("[data-slot=toast]"),
        /** index번째 제목을 우클릭해 미리보기를 연다. */
        openPreview: async (index = 0): Promise<Locator> => {
            await titles.nth(index).click({button: "right"});
            return frame;
        },
        /** 커서를 목록 밖으로 뺀다. */
        leave: () => page.mouse.move(0, 0)
    };
}

export type ListPage = Awaited<ReturnType<typeof openListPage>>;
