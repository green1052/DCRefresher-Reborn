import {expect, test} from "./fixtures";

test.describe("글 목록", () => {
    test("유저 정보 배지와 새로고침 버튼이 붙는다", async ({listPage}) => {
        const badges = listPage.badges();
        await expect(badges).toHaveCount(2);
        await expect(badges.first()).toHaveText("(user3)");
        await expect(listPage.refreshButton()).toHaveText("자동 새로고침: 켜짐");
        // 오버레이는 필요할 때까지 띄우지 않는다
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
        await storage.set({"refresher:modules": {userinfo: false, refresh: false}});
        await expect(listPage.badges()).toHaveCount(0);
        await expect(listPage.refreshButton()).toHaveCount(0);

        await storage.set({"refresher:modules": {}});
        await expect(listPage.badges()).toHaveCount(2);
        await expect(listPage.refreshButton()).toHaveCount(1);
    });
});

test.describe("미리보기", () => {
    test("제목을 우클릭하면 창이 뜨고 본문·댓글을 그린다. 닫으면 주소가 돌아온다", async ({listPage}) => {
        await listPage.page.locator(".gall_list .ub-word").first().click({button: "right"});

        const frame = listPage.overlay().locator(".refresher-frame");
        await expect(frame.locator("h2")).toHaveText("[말머리] 글 3 제목");
        await expect(frame.locator(".refresher-preview-contents")).toContainText("본문 3 내용입니다.");
        await expect(frame.locator(".refresher-comment")).toHaveCount(2);
        await expect(frame.getByText("스레드 1개, 총 댓글 2개")).toBeVisible();
        await expect(listPage.page).toHaveURL(/\/board\/view\/\?id=test&no=3/);

        // 정화: 본문 이미지는 lazy로, 오버레이의 Radix 버튼은 스타일이 붙어 있다
        await expect(frame.locator(".refresher-preview-contents img")).toHaveAttribute("loading", "lazy");
        const styled = await frame.locator(".rt-BaseButton").first().evaluate((element) => getComputedStyle(element).cursor === "pointer");
        expect(styled).toBe(true);

        await listPage.page.keyboard.press("Escape");
        await expect(frame).toHaveCount(0);
        await expect(listPage.page).toHaveURL(/\/board\/lists\/\?id=test$/);
    });

    test("댓글 수를 우클릭하면 댓글만 보기로 열리고, 좌클릭은 원래대로 이동한다", async ({listPage}) => {
        const replies = listPage.page.locator(".gall_list .reply_numbox").first();
        await replies.click({button: "right"});
        const frame = listPage.overlay().locator(".refresher-frame");
        await expect(frame.getByRole("button", {name: /댓글만 표시 중입니다/})).toBeVisible();
        await expect(frame.locator(".refresher-comment")).toHaveCount(2);

        await listPage.page.keyboard.press("Escape");
        await expect(frame).toHaveCount(0);
        await replies.click();
        await expect(listPage.page).toHaveURL(/\/board\/view\/\?id=test&no=3$/);
    });

    test("키 반전이면 댓글 수 좌클릭이 댓글만 보기로 열린다", async ({listPage, storage}) => {
        await storage.set({"refresher:module:preview:settings": {reversePreviewKey: true}});
        await listPage.page.locator(".gall_list .reply_numbox").first().click();
        const frame = listPage.overlay().locator(".refresher-frame");
        await expect(frame.getByRole("button", {name: /댓글만 표시 중입니다/})).toBeVisible();
        await expect(listPage.page).toHaveURL(/\/board\/view\/\?id=test&no=3/);
    });
});

test.describe("미니 미리보기", () => {
    test("켜면 제목에 마우스를 올릴 때 카드가 뜨고, 떠나면 닫힌다", async ({listPage, storage}) => {
        await storage.set({"refresher:module:preview:settings": {tooltipMode: true, tooltipDelay: 0}});
        const title = listPage.page.locator(".gall_list .ub-word").first();
        await expect.poll(async () => {
            await listPage.page.mouse.move(0, 0);
            await title.hover();
            return listPage.overlay().locator(".refresher-mini-preview").count();
        }).toBe(1);
        await expect(listPage.overlay().locator(".refresher-mini-contents")).toContainText("본문 3 내용입니다.");

        await listPage.page.mouse.move(0, 0);
        await expect(listPage.overlay().locator(".refresher-mini-preview")).toHaveCount(0);
    });
});

test.describe("유저 버블", () => {
    test("작성자를 우클릭하면 버블이 뜨고 차단하면 행이 가려진다", async ({listPage, storage}) => {
        await listPage.page.locator(".gall_list .ub-writer").first().click({button: "right"});

        const bubble = listPage.overlay().locator(".rt-PopoverContent");
        await expect(bubble).toContainText("user3");
        await expect(bubble).toContainText("12 / 34");
        await bubble.getByRole("button", {name: "유저 차단"}).click();

        await expect(listPage.overlay().locator(".refresher-toast")).toContainText("차단 목록에 추가했습니다.");
        // 오버레이가 이 토스트와 함께 붙어도 스크린 리더 알림 칸에 들어간다
        await expect(listPage.overlay().getByRole("status")).toContainText("차단 목록에 추가했습니다.");
        await expect(listPage.rows().first()).toHaveClass(/refresherBlocked/);
        expect(await storage.get("refresher:block:ID")).toMatchObject([{content: "user3", extra: "고닉"}]);
    });
});
