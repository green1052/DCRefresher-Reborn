import {expect, test} from "../fixtures";
import {openListPage} from "../pages/list";

/**
 * 실제 디시에서 읽기만 한다 (bun run e2e:live). 디시 마크업·API가 바뀌면 여기서 걸린다. 쓰기 요청은 픽스처가 끊는다.
 * 글·댓글은 그때그때 다르므로 개수·내용이 아니라 모양만 본다.
 * 기본은 미니 갤러리 bjwg64다. 콘텐츠 스크립트는 모바일 페이지에서 돌지 않아 PC 주소로 연다. DC_LIST_URL로 다른 갤러리의 PC 목록 주소를 줄 수 있다.
 */
const LIST_URL = process.env.DC_LIST_URL ?? "https://gall.dcinside.com/mini/board/lists/?id=bjwg64";
const {pathname: LIST_PATH, searchParams} = new URL(LIST_URL);
const GALLERY = searchParams.get("id") ?? "";
/** 공지·설문·광고가 아닌 글 행. */
const POSTS = ".gall_list tbody tr.us-post[data-no]:not([data-type=icon_notice], [data-type=icon_survey])";
const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

test.describe("실제 디시", () => {
    test("글 목록에 배지와 새로고침 버튼을 붙이고, 자동 새로고침이 같은 목록을 다시 받는다", async ({page}) => {
        const list = await openListPage(page, LIST_URL);
        await expect(page.locator(POSTS).first()).toBeVisible();
        await expect(list.refreshButton).toHaveText("자동 새로고침: 켜짐");
        await expect.poll(() => list.badges.count()).toBeGreaterThan(0);

        const refreshed = await page.waitForResponse((response) => response.url().includes(LIST_PATH.replace(/\/$/, "")) && response.request().resourceType() !== "document", {timeout: 30_000});
        expect(refreshed.ok()).toBe(true);
        await expect(page.locator(POSTS).first()).toBeVisible();
    });

    test("제목을 우클릭하면 본문과 댓글 머리를 그리고, 닫으면 목록 주소로 돌아간다", async ({page}) => {
        const list = await openListPage(page, LIST_URL);
        const post = page.locator(POSTS).first();
        const no = await post.getAttribute("data-no");
        await post.locator(".ub-word").click({button: "right"});

        await expect(list.frameTitle).not.toBeEmpty();
        await expect(list.frame.locator(".refresher-preview-contents")).toBeVisible();
        await expect(list.frame.getByText(/^스레드 \d+개, 총 댓글 \d+개|^댓글이 없습니다\.$/).first()).toBeVisible();
        await expect(page).toHaveURL(new RegExp(`${escape(LIST_PATH.replace("/lists", "/view"))}\\?id=${GALLERY}&no=${no}`));

        await page.keyboard.press("Escape");
        await expect(list.frame).toHaveCount(0);
        await expect(page).toHaveURL(LIST_URL);
    });

    test("댓글 수를 우클릭하면 댓글 목록 API로 받은 댓글을 그린다", async ({page}) => {
        const list = await openListPage(page, LIST_URL);
        const replies = page.locator(`${POSTS} .reply_numbox`).first();
        test.skip(await replies.count() === 0, "첫 쪽에 댓글 달린 글이 없다");
        const fetched = page.waitForResponse((response) => new URL(response.url()).pathname === "/board/comment/");
        await replies.click({button: "right"});

        await expect(list.frame.getByRole("button", {name: /댓글만 표시 중입니다/})).toBeVisible();
        expect((await fetched).ok()).toBe(true);
        // 댓글이 모두 지워졌을 수도 있어 머리의 개수 줄만 꼭 본다. 그린 댓글이 있으면 작성자가 붙어 있다.
        await expect(list.frame.getByText(/^스레드 \d+개, 총 댓글 \d+개/)).toBeVisible();
        if (await list.comments.count()) await expect(list.comments.first().locator(".refresher-user")).toBeVisible();
    });

    test("회원 작성자를 우클릭하면 버블에 갤로그 글/댓글 수가 보인다", async ({page}) => {
        const list = await openListPage(page, LIST_URL);
        const member = page.locator(`${POSTS} .ub-writer:not([data-uid=""])`).first();
        test.skip(await member.count() === 0, "첫 쪽에 회원 글이 없다");
        const uid = await member.getAttribute("data-uid");
        await member.click({button: "right"});

        await expect(list.bubble).toContainText(uid ?? "");
        await expect(list.bubble).toContainText(/[\d,]+ \/ [\d,]+/);
    });

    test("글 페이지에서도 콘텐츠 스크립트가 돈다", async ({page}) => {
        await openListPage(page, LIST_URL);
        const href = await page.locator(`${POSTS} .ub-word a`).first().getAttribute("href");
        await page.goto(new URL(href ?? "", LIST_URL).href);
        await expect(page.locator(".writing_view_box")).toBeVisible();
        // 글 아래 목록에도 새로고침 버튼을 붙인다.
        await expect(page.locator("button[data-refresher-refresh]")).toHaveCount(1);
        await expect.poll(() => page.locator(".refresher-user-badges").count()).toBeGreaterThan(0);
    });
});
