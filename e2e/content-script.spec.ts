import {commentsResponse} from "./dcinside";
import {expect, test} from "./fixtures";

test.describe("글 목록", () => {
    test("유저 정보 배지와 새로고침 버튼이 붙는다", async ({listPage}) => {
        const badges = listPage.badges();
        await expect(badges).toHaveCount(2);
        await expect(badges.first()).toHaveText("(user3)");
        await expect(listPage.refreshButton()).toHaveText("자동 새로고침: 켜짐");
        // 오버레이는 필요할 때까지 띄우지 않는다.
        await expect(listPage.overlay()).toHaveCount(0);
    });

    test("차단 목록의 닉네임이 있는 행을 숨기고, 목록을 바꾸면 바로 반영된다", async ({listPage, storage}) => {
        const rows = listPage.rows();
        await expect(rows.nth(1)).toBeVisible();

        await storage.set({"refresher:block:NICK": [{content: "ㅇㅇ", isRegex: false}]});
        await expect(rows.nth(1)).toHaveClass(/refresherBlocked/);
        await expect(rows.nth(1)).toBeHidden();
        await expect(rows.nth(0)).not.toHaveClass(/refresherBlocked/);

        await storage.set({"refresher:block:NICK": []});
        await expect(rows.nth(1)).not.toHaveClass(/refresherBlocked/);
    });

    test("모듈을 끄면 넣은 것을 되돌린다", async ({listPage, storage}) => {
        await storage.setModules({userinfo: false, refresh: false});
        await expect(listPage.badges()).toHaveCount(0);
        await expect(listPage.refreshButton()).toHaveCount(0);

        await storage.setModules({});
        await expect(listPage.badges()).toHaveCount(2);
        await expect(listPage.refreshButton()).toHaveCount(1);
    });
});

test.describe("미리보기", () => {
    test("제목을 우클릭하면 창이 뜨고 본문·댓글을 그린다. 닫으면 주소가 돌아온다", async ({listPage}) => {
        await listPage.titles().first().click({button: "right"});

        const frame = listPage.frame();
        await expect(frame.locator("h2")).toHaveText("[말머리] 글 3 제목");
        await expect(frame.locator(".refresher-preview-contents")).toContainText("본문 3 내용입니다.");
        await expect(frame.locator(".refresher-comment")).toHaveCount(2);
        await expect(frame.getByText("스레드 1개, 총 댓글 2개")).toBeVisible();
        await expect(listPage.page).toHaveURL(/\/board\/view\/\?id=test&no=3/);

        // 정화: 본문 이미지는 lazy로, 오버레이의 Radix 버튼은 스타일이 붙어 있다.
        await expect(frame.locator(".refresher-preview-contents img")).toHaveAttribute("loading", "lazy");
        const styled = await frame.locator(".rt-BaseButton").first().evaluate((element) => getComputedStyle(element).cursor === "pointer");
        expect(styled).toBe(true);

        await listPage.page.keyboard.press("Escape");
        await expect(frame).toHaveCount(0);
        await expect(listPage.page).toHaveURL(/\/board\/lists\/\?id=test$/);
    });

    test("댓글 수를 우클릭하면 댓글만 보기로 열리고, 좌클릭은 원래대로 이동한다", async ({listPage}) => {
        const replies = listPage.replyCounts().first();
        await replies.click({button: "right"});
        const frame = listPage.frame();
        await expect(frame.getByRole("button", {name: /댓글만 표시 중입니다/})).toBeVisible();
        await expect(frame.locator(".refresher-comment")).toHaveCount(2);

        await listPage.page.keyboard.press("Escape");
        await expect(frame).toHaveCount(0);
        await replies.click();
        await expect(listPage.page).toHaveURL(/\/board\/view\/\?id=test&no=3$/);
    });

    test("키 반전이면 댓글 수 좌클릭이 댓글만 보기로 열린다", async ({listPage, storage}) => {
        await storage.setModuleSettings("preview", {reversePreviewKey: true});
        await listPage.replyCounts().first().click();
        const frame = listPage.frame();
        await expect(frame.getByRole("button", {name: /댓글만 표시 중입니다/})).toBeVisible();
        await expect(listPage.page).toHaveURL(/\/board\/view\/\?id=test&no=3/);
    });
});

test.describe("미리보기 부가 기능", () => {
    test("J/K로 글을 고르고 Enter로 열면, 닫은 뒤 읽은 글로 흐려진다", async ({listPage, storage}) => {
        const {page} = listPage;
        const rows = listPage.rows();
        await page.keyboard.press("j");
        await expect(rows.nth(0)).toHaveClass(/refresherSelected/);
        await page.keyboard.press("j");
        await expect(rows.nth(1)).toHaveClass(/refresherSelected/);
        await expect(rows.nth(0)).not.toHaveClass(/refresherSelected/);
        await page.keyboard.press("k");
        await expect(rows.nth(0)).toHaveClass(/refresherSelected/);

        await page.keyboard.press("Enter");
        await expect(listPage.frame().locator("h2")).toHaveText("[말머리] 글 3 제목");
        await page.keyboard.press("Escape");
        await expect(listPage.frame()).toHaveCount(0);

        await expect(rows.nth(0)).toHaveClass(/refresherRead/);
        await expect(rows.nth(1)).not.toHaveClass(/refresherRead/);
        await expect.poll(() => storage.get("refresher:module:preview:data")).toEqual({read: ["test:3"]});
    });

    test("본문 이미지를 누르면 크게 보고, Esc는 크게 보기만 닫는다", async ({listPage}) => {
        await listPage.titles().first().click({button: "right"});
        const frame = listPage.frame();
        const image = frame.locator(".refresher-preview-contents img");
        await expect(image).toHaveJSProperty("complete", true);
        await image.click({force: true});

        const viewer = listPage.overlay().locator(".refresher-viewer");
        await expect(viewer.locator("img")).toHaveAttribute("src", /viewimage\.php\?id=test&no=3/);
        await expect(viewer.getByRole("link", {name: "원본 보기"})).toHaveCount(0);

        await listPage.page.keyboard.press("Escape");
        await expect(viewer).toHaveCount(0);
        await expect(frame).toBeVisible();
    });

    test("댓글을 새로고침하면 새로 들어온 댓글만 강조한다", async ({listPage}) => {
        await listPage.titles().first().click({button: "right"});
        const comments = listPage.frame().locator(".refresher-comment");
        await expect(comments).toHaveCount(2);
        await expect(listPage.frame().locator(".refresher-comment[data-fresh]")).toHaveCount(0);

        // 이 페이지의 댓글 응답에만 새 댓글을 하나 더한다 (페이지 route가 컨텍스트 route보다 먼저다).
        await listPage.page.route(/\/board\/comment\//, async (route) => {
            const body = JSON.parse(commentsResponse()) as { comments: object[]; total_cnt: number };
            body.comments.push({no: "12", c_no: "12", depth: 0, user_id: "user2", name: "고닉", ip: "", memo: "새 댓글", is_delete: "0", date_time: "2026.09.30 12:03:00", reg_date: "2026-09-30 12:03:00"});
            body.total_cnt = 3;
            await route.fulfill({contentType: "application/json", body: JSON.stringify(body)});
        });
        await listPage.frame().getByRole("button", {name: "댓글 새로고침"}).click();

        await expect(comments).toHaveCount(3);
        const fresh = listPage.frame().locator(".refresher-comment[data-fresh]");
        await expect(fresh).toHaveCount(1);
        await expect(fresh).toContainText("새 댓글");
    });
});

test.describe("미니 미리보기", () => {
    test("켜면 제목에 마우스를 올릴 때 카드가 뜨고, 떠나면 닫힌다", async ({listPage, storage}) => {
        await storage.setModuleSettings("preview", {tooltipMode: true, tooltipDelay: 0});
        const title = listPage.titles().first();
        await expect.poll(async () => {
            await listPage.leave();
            await title.hover();
            return listPage.mini().count();
        }).toBe(1);
        await expect(listPage.mini().locator(".refresher-mini-contents")).toContainText("본문 3 내용입니다.");

        await listPage.leave();
        await expect(listPage.mini()).toHaveCount(0);
    });

    test("다른 제목으로 옮기면 카드가 그 글로 바뀐다", async ({listPage, storage}) => {
        await storage.setModuleSettings("preview", {tooltipMode: true, tooltipDelay: 0});
        const contents = listPage.mini().locator(".refresher-mini-contents");
        await expect.poll(async () => {
            await listPage.leave();
            await listPage.titles().nth(0).hover();
            return contents.textContent();
        }).toContain("본문 3 내용입니다.");

        await listPage.titles().nth(1).hover();
        await expect(contents).toContainText("본문 2 내용입니다.");
    });
});

test.describe("유저 버블", () => {
    test("작성자를 우클릭하면 버블이 뜨고 차단하면 행이 가려진다", async ({listPage, storage}) => {
        await listPage.writers().first().click({button: "right"});

        const bubble = listPage.bubble();
        await expect(bubble).toContainText("user3");
        await expect(bubble).toContainText("12 / 34");
        await bubble.getByRole("button", {name: "유저 차단"}).click();

        await expect(listPage.toast()).toContainText("차단 목록에 추가했습니다.");
        // 스크린 리더 알림 칸에도 들어간다.
        await expect(listPage.overlay().getByRole("status")).toContainText("차단 목록에 추가했습니다.");
        await expect(listPage.rows().first()).toHaveClass(/refresherBlocked/);
        expect(await storage.get("refresher:block:ID")).toMatchObject([{content: "user3", extra: "고닉"}]);
    });
});
