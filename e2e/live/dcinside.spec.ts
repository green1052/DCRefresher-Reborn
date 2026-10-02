import {expect, test} from "../fixtures";
import {openListPage} from "../pages/list";

/**
 * 실제 디시에서 돈다 (bun run e2e:live). 가짜 페이지(e2e/dcinside.ts)와 달리 디시 마크업·API가 바뀌면 여기서 걸린다.
 * 글·댓글은 그때그때 다르므로 개수나 내용이 아니라 모양만 본다. 쓰기 요청은 픽스처(routeLive)가 끊는다.
 */
// 기본은 미니 갤러리다 (m.dcinside.com/mini/bjwg64). 콘텐츠 스크립트는 모바일 페이지에서 돌지 않으므로 PC 주소로 연다.
// DC_LIST_URL로 다른 갤러리 목록을 줄 수 있다 (일반 갤러리면 /board/lists/?id=…).
const LIST_URL = process.env.DC_LIST_URL ?? "https://gall.dcinside.com/mini/board/lists/?id=bjwg64";
const {pathname: LIST_PATH, searchParams} = new URL(LIST_URL);
const GALLERY = searchParams.get("id")!;
/** 이 갤러리의 글 주소 (/board/lists → /board/view, 미니·마이너는 앞에 /mini·/mgallery가 붙는다). */
const VIEW_URL = new RegExp(`${LIST_PATH.replace("/lists", "/view").replace(/\//g, "\\/")}\\?id=${GALLERY}&no=`);

/** 공지·설문·광고가 아닌 글 행. */
const POSTS = `.gall_list tbody tr.us-post[data-no]:not([data-type="icon_notice"], [data-type="icon_survey"])`;

test.describe("실제 디시", () => {
    test("글 목록에 유저 정보 배지와 새로고침 버튼이 붙고, 자동 새로고침이 목록을 다시 받는다", async ({page}) => {
        const list = await openListPage(page, LIST_URL);
        await expect(page.locator(POSTS).first()).toBeVisible();
        await expect(list.refreshButton()).toHaveText("자동 새로고침: 켜짐");
        await expect.poll(() => list.badges().count()).toBeGreaterThan(0);

        // 자동 새로고침은 같은 목록 주소를 다시 받는다.
        await page.waitForResponse((response) => response.url().includes("/board/lists") && response.request().resourceType() !== "document", {timeout: 30_000});
        await expect(page.locator(POSTS).first()).toBeVisible();
    });

    test("제목을 우클릭하면 글을 받아 본문을 그리고, 닫으면 주소가 돌아온다", async ({page}) => {
        const list = await openListPage(page, LIST_URL);
        const post = page.locator(POSTS).first();
        const no = await post.getAttribute("data-no");
        await post.locator(".ub-word").click({button: "right"});

        const frame = list.frame();
        await expect(frame.locator("h2")).not.toBeEmpty();
        await expect(frame.locator(".refresher-preview-contents")).toBeVisible();
        await expect(frame.getByText(/스레드 \d+개, 총 댓글 \d+개|댓글이 없습니다/).first()).toBeVisible();
        await expect(page).toHaveURL(new RegExp(`${VIEW_URL.source}${no}`));

        await page.keyboard.press("Escape");
        await expect(frame).toHaveCount(0);
        await expect(page).toHaveURL(new URL(LIST_URL).href);
    });

    test("댓글 수를 우클릭하면 댓글을 받아 그린다", async ({page}) => {
        const list = await openListPage(page, LIST_URL);
        const replies = page.locator(`${POSTS} .reply_numbox`).first();
        test.skip(!(await replies.count()), "첫 쪽에 댓글 달린 글이 없다");
        await replies.click({button: "right"});

        const frame = list.frame();
        await expect(frame.getByRole("button", {name: /댓글만 표시 중입니다/})).toBeVisible();
        // 댓글이 모두 지워졌거나 막혔을 수도 있어 머리의 개수 줄만 본다. 그려진 댓글이 있으면 작성자가 붙어 있다.
        await expect(frame.getByText(/스레드 \d+개, 총 댓글 \d+개/)).toBeVisible();
        const comments = frame.locator(".refresher-comment");
        if (await comments.count()) await expect(comments.first().locator(".refresher-user")).toBeVisible();
    });

    test("회원 작성자를 우클릭하면 갤로그 글/댓글 수가 보인다", async ({page}) => {
        const list = await openListPage(page, LIST_URL);
        const member = page.locator(`${POSTS} .ub-writer:not([data-uid=""])`).first();
        test.skip(!(await member.count()), "첫 쪽에 회원 글이 없다");
        const uid = await member.getAttribute("data-uid");
        await member.click({button: "right"});

        const bubble = list.bubble();
        await expect(bubble).toContainText(uid!);
        await expect(bubble).toContainText(/[\d,]+ \/ [\d,]+/);
    });

    test("글 페이지에서도 콘텐츠 스크립트가 돈다", async ({page}) => {
        const list = await openListPage(page, LIST_URL);
        const href = await page.locator(`${POSTS} .ub-word a`).first().getAttribute("href");
        await page.goto(new URL(href!, LIST_URL).href);
        await expect(page.locator(".writing_view_box")).toBeVisible();
        await expect(list.refreshButton()).toHaveCount(1);
    });
});
