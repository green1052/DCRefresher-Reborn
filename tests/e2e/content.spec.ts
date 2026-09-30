import {expect, overlay, test} from "./fixtures";

test.describe("글 목록", () => {
    test("유저 정보 배지와 새로고침 버튼이 붙는다", async ({listPage: page}) => {
        const badges = page.locator(".refresher-user-badges");
        await expect(badges).toHaveCount(2);
        await expect(badges.first()).toHaveText("(user3)");
        await expect(page.locator("button[data-refresher-refresh]")).toHaveText("자동 새로고침: 켜짐");
        // 오버레이는 필요할 때까지 띄우지 않는다
        await expect(overlay(page)).toHaveCount(0);
    });

    test("차단 목록의 닉네임이 있는 행을 숨기고, 목록을 바꾸면 바로 반영된다", async ({listPage: page, storage}) => {
        const rows = page.locator(".gall_list tbody tr");
        await expect(rows.nth(1)).toBeVisible();

        await storage.set({"refresher:block:NICK": [{content: "ㅇㅇ", isRegex: false}]});
        await expect(rows.nth(1)).toHaveClass(/refresherBlocked/);
        await expect(rows.nth(1)).toBeHidden();
        await expect(rows.nth(0)).not.toHaveClass(/refresherBlocked/);

        await storage.set({"refresher:block:NICK": []});
        await expect(rows.nth(1)).not.toHaveClass(/refresherBlocked/);
    });

    test("모듈을 끄면 넣은 것을 되돌린다", async ({listPage: page, storage}) => {
        await storage.set({"refresher:modules": {userinfo: false, refresh: false}});
        await expect(page.locator(".refresher-user-badges")).toHaveCount(0);
        await expect(page.locator("button[data-refresher-refresh]")).toHaveCount(0);

        await storage.set({"refresher:modules": {}});
        await expect(page.locator(".refresher-user-badges")).toHaveCount(2);
        await expect(page.locator("button[data-refresher-refresh]")).toHaveCount(1);
    });
});

test.describe("미리보기", () => {
    test("제목을 우클릭하면 창이 뜨고 본문·댓글을 그린다. 닫으면 주소가 돌아온다", async ({listPage: page}) => {
        await page.locator(".gall_list .ub-word").first().click({button: "right"});

        const frame = overlay(page).locator(".refresher-frame");
        await expect(frame.locator("h2")).toHaveText("[말머리] 글 3 제목");
        await expect(frame.locator(".refresher-preview-contents")).toContainText("본문 3 내용입니다.");
        await expect(frame.locator(".refresher-comment")).toHaveCount(2);
        await expect(frame.getByText("스레드 1개, 총 댓글 2개")).toBeVisible();
        await expect(page).toHaveURL(/\/board\/view\/\?id=test&no=3/);

        // 정화: 본문 이미지는 lazy로, 오버레이의 Radix 버튼은 스타일이 붙어 있다
        await expect(frame.locator(".refresher-preview-contents img")).toHaveAttribute("loading", "lazy");
        const styled = await frame.locator(".rt-BaseButton").first().evaluate((element) => getComputedStyle(element).cursor === "pointer");
        expect(styled).toBe(true);

        await page.keyboard.press("Escape");
        await expect(frame).toHaveCount(0);
        await expect(page).toHaveURL(/\/board\/lists\/\?id=test$/);
    });

    test("댓글 수를 누르면 댓글만 보기로 열린다", async ({listPage: page}) => {
        await page.locator(".gall_list .reply_numbox").first().click();
        const frame = overlay(page).locator(".refresher-frame");
        await expect(frame.getByRole("button", {name: /댓글만 표시 중입니다/})).toBeVisible();
        await expect(frame.locator(".refresher-comment")).toHaveCount(2);
    });
});

test.describe("유저 버블", () => {
    test("작성자를 우클릭하면 버블이 뜨고 차단하면 행이 가려진다", async ({listPage: page, storage}) => {
        await page.locator(".gall_list .ub-writer").first().click({button: "right"});

        const bubble = overlay(page).locator(".rt-PopoverContent");
        await expect(bubble).toContainText("user3");
        await expect(bubble).toContainText("12 / 34");
        await bubble.getByRole("button", {name: "유저 차단"}).click();

        await expect(overlay(page).locator(".refresher-toast")).toContainText("차단 목록에 추가했습니다.");
        await expect(page.locator(".gall_list tbody tr").first()).toHaveClass(/refresherBlocked/);
        expect(await storage.get("refresher:block:ID")).toMatchObject([{content: "user3", extra: "고닉"}]);
    });
});
