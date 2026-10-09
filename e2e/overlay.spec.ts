import type {Page} from "@playwright/test";

import {fakeComment} from "./dcinside";
import {expect, test} from "./fixtures";

test.describe("유저 버블", () => {
    test("작성자를 우클릭하면 갤로그 글/댓글 수가 보이고, 차단하면 행을 가린다", async ({listPage, storage}) => {
        await listPage.writers.first().click({button: "right"});

        const {bubble} = listPage;
        await expect(bubble).toContainText("user3");
        await expect(bubble).toContainText("12 / 34");
        await bubble.getByRole("button", {name: "유저 차단"}).click();

        await expect(listPage.toast).toContainText("차단 목록에 추가했습니다.");
        // 스크린 리더가 읽는 알림 칸(aria-live) 안에 뜬다.
        await expect(listPage.overlay.getByRole("region", {name: "알림"})).toHaveAttribute("aria-live", "polite");
        await expect(listPage.overlay.getByRole("region", {name: "알림"})).toContainText("차단 목록에 추가했습니다.");
        await expect(listPage.row(3)).toHaveClass(/refresherBlocked/);
        expect(await storage.get("refresher:block:ID")).toMatchObject([{content: "user3", extra: "고닉"}]);
    });

    test("버블은 막은 규칙을 보이고, 허용 목록 항목에는 해제 버튼을 두지 않는다", async ({listPage, storage}) => {
        // 흐리게 가려야 가린 행의 작성자를 우클릭할 수 있다.
        await storage.setModuleSettings("block", {blur: true});
        await storage.set({"refresher:block:NICK": [{id: "a", content: "고닉", isRegex: false, mode: "NOT_SAME"}, {id: "b", content: "ㅇㅇ", isRegex: false, mode: "SAME"}]});
        await expect(listPage.row(2)).toHaveClass(/refresherBlur/);
        await listPage.row(2).locator(".ub-writer").click({button: "right"});

        const {bubble} = listPage;
        await expect(bubble.getByRole("button", {name: "닉네임 ㅇㅇ 차단 해제"})).toBeVisible();
        // 허용 목록(고닉만 보기)의 항목을 지우면 이 사람은 그대로 막히고 고닉까지 막힌다.
        await expect(bubble.getByText("허용 목록에 없음")).toBeVisible();
        await expect(bubble.getByRole("button", {name: "닉네임 고닉 차단 해제"})).toHaveCount(0);
    });

    test("규칙을 해제하면 토스트의 되돌리기로 다시 걸고 토스트를 닫는다", async ({listPage, storage}) => {
        await storage.setModuleSettings("block", {blur: true});
        await storage.set({"refresher:block:NICK": [{id: "b", content: "ㅇㅇ", isRegex: false, mode: "SAME"}]});
        await expect(listPage.row(2)).toHaveClass(/refresherBlur/);
        await listPage.row(2).locator(".ub-writer").click({button: "right"});
        await listPage.bubble.getByRole("button", {name: "닉네임 ㅇㅇ 차단 해제"}).click();

        const {toast} = listPage;
        await expect(toast).toContainText("차단을 해제했습니다.");
        await toast.getByRole("button", {name: "되돌리기"}).click();

        await expect(toast).toHaveCount(0);
        await expect.poll(() => storage.get("refresher:block:NICK")).toMatchObject([{content: "ㅇㅇ", mode: "SAME"}]);
    });

    test("미리보기 위에 띄운 버블은 Esc에 버블만 닫히고 미리보기는 남는다", async ({listPage}) => {
        const frame = await listPage.openPreview();
        await frame.locator(".refresher-user").first().click({button: "right"});
        await expect(listPage.bubble).toBeVisible();

        await listPage.page.keyboard.press("Escape");
        await expect(listPage.bubble).toHaveCount(0);
        await expect(frame).toBeVisible();
    });
});

test.describe("메모", () => {
    test("버블에서 메모 창을 열어 저장하면 저장소에 남고 목록 배지에 붙는다. Tab은 창 밖으로 나가지 않는다", async ({listPage, storage}) => {
        await listPage.writers.first().click({button: "right"});
        await listPage.bubble.getByRole("button", {name: "메모", exact: true}).click();

        const {dialog, page} = listPage;
        await expect(dialog.getByRole("heading", {name: "메모", exact: true})).toBeVisible();
        const input = dialog.getByRole("textbox", {name: "메모", exact: true});
        await expect(input).toBeFocused();
        await input.fill("테스트 메모");

        // 오버레이(shadow DOM) 안에서도 Tab·Shift+Tab이 디시 페이지로 나가지 않는다.
        const focusInside = () => dialog.evaluate((element) => document.activeElement?.tagName === "REFRESHER-ROOT" && element.contains((element.getRootNode() as ShadowRoot).activeElement));
        for (const key of ["Tab", "Shift+Tab"]) {
            for (let i = 0; i < 12; i++) {
                await page.keyboard.press(key);
                expect(await focusInside()).toBe(true);
            }
        }
        await dialog.getByRole("button", {name: "저장", exact: true}).click();

        await expect(dialog).toHaveCount(0);
        await expect(listPage.toast).toContainText("메모를 저장했습니다.");
        await expect.poll(() => storage.get("refresher:memo:UID")).toMatchObject({user3: {text: "테스트 메모"}});
        await expect(listPage.row(3)).toContainText("테스트 메모");
    });
});

test.describe("오버레이 포커스", () => {
    test("키보드로 연 버블과 거기서 연 메모 창을 닫으면 포커스가 연 닉네임으로 돌아온다", async ({listPage}) => {
        const {page, frame, bubble, dialog} = listPage;
        // 키보드로 열어야 포커스를 돌려준다. J로 고르고 Enter로 미리보기를 연다.
        await page.keyboard.press("j");
        await page.keyboard.press("Enter");
        await expect(listPage.frameTitle).toHaveText("[말머리] 글 3 제목");

        // 창 머리의 글쓴이 닉네임까지 Tab으로 간다.
        const nick = frame.locator(".refresher-user button").first();
        await expect(nick).toHaveText("고닉");
        await expect(async () => {
            await page.keyboard.press("Tab");
            await expect(nick).toBeFocused({timeout: 100});
        }).toPass();

        await page.keyboard.press("Enter");
        await expect(bubble).toBeVisible();
        // 키보드로 열면 버블 안으로 포커스가 옮겨 간다.
        await expect.poll(() => bubble.evaluate((element) => element.contains((element.getRootNode() as ShadowRoot).activeElement))).toBe(true);
        await page.keyboard.press("Escape");
        await expect(bubble).toHaveCount(0);
        await expect(nick).toBeFocused();

        // 닫은 직후 Enter로 다시 연다. 닫힌 버블의 남은 리스너가 여는 클릭을 바깥 클릭으로 보고 닫으면 안 된다.
        await page.keyboard.press("Enter");
        await expect(bubble).toBeVisible();
        await bubble.getByRole("button", {name: "메모", exact: true}).click();
        await expect(dialog.getByRole("textbox", {name: "메모", exact: true})).toBeFocused();
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        await expect(nick).toBeFocused();
        await expect(frame).toBeVisible();
    });
});

test.describe("글 페이지 댓글", () => {
    const SAME = "같은 내용의 댓글입니다";
    const openView = async (page: Page) => {
        await page.goto("https://gall.dcinside.com/board/view/?id=test&no=3");
        return page.locator(".cmt_list > li");
    };

    test("같은 댓글은 첫 댓글에 배지를 달고 접는다. 첫 댓글을 차단하면 남은 댓글로 다시 센다", async ({page, site, storage}) => {
        await storage.setModuleSettings("block", {foldDuplicate: true, duplicateCount: 3});
        site.pageComments = ["가", "나", "다"].map((name, index) => fakeComment(20 + index, {name, memo: SAME}));
        const items = await openView(page);

        await expect(items.nth(0).locator(".refresherDuplicateBadge")).toHaveText("같은 댓글 ×3");
        await expect(items.nth(1)).toHaveClass(/refresherDuplicate/);
        await expect(items.nth(2)).toBeHidden();

        // 둘만 남아 기준(3번) 아래다. 접었던 댓글을 다시 보이고 배지도 뗀다.
        await storage.set({"refresher:block:NICK": [{id: "a", content: "가", isRegex: false}]});
        await expect(items.nth(0)).toBeHidden();
        await expect(items.nth(1)).toBeVisible();
        await expect(items.nth(2)).toBeVisible();
        await expect(page.locator(".refresherDuplicateBadge")).toHaveCount(0);
    });

    test("깡계로 숨긴 댓글은 세지 않아 같은 내용의 다른 댓글까지 접지 않는다", async ({page, site, storage}) => {
        await storage.setModuleSettings("block", {foldDuplicate: true, duplicateCount: 3});
        await storage.setModuleSettings("userinfo", {checkRatio: true, alarmRatio: 10, lowActivityAction: "hide"});
        // 첫 댓글 작성자는 글댓비를 받아 둔 깡계다.
        await storage.set({"refresher:module:userinfo:data": {ratio: {low1: {article: 1, comment: 2, date: Date.now()}}}});
        site.pageComments = [
            fakeComment(20, {name: "깡계", user_id: "low1", ip: "", memo: SAME}),
            fakeComment(21, {name: "나", memo: SAME}),
            fakeComment(22, {name: "다", memo: SAME})
        ];
        const items = await openView(page);

        await expect(items.nth(0)).toHaveClass(/refresherLowActivityHide/);
        await expect(items.nth(1)).toBeVisible();
        await expect(items.nth(2)).toBeVisible();
        await expect(page.locator(".refresherDuplicateBadge")).toHaveCount(0);
    });

    test("글 머리의 작성자에도 유저 정보 배지를 붙인다", async ({page}) => {
        await openView(page);
        await expect(page.locator(".gallview_head .refresher-user-badges")).toHaveText("(user3)");
    });
});
