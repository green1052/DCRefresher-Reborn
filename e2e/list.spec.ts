import {expect, test} from "./fixtures";

test.describe("글 목록", () => {
    test("작성자 칸에 유저 정보 배지를, 갤러리 머리에 새로고침 버튼을 붙인다", async ({listPage}) => {
        // 회원 행에만 아이디 배지가 붙는다. 유동 행의 IP 정보는 IP DB를 끊어 두어 붙지 않는다.
        await expect(listPage.badges).toHaveText(["(user3)", "(user1)"]);
        await expect(listPage.refreshButton).toHaveText("자동 새로고침: 켜짐");
        // 오버레이는 그릴 것이 생길 때까지 붙이지 않는다.
        await expect(listPage.overlay).toHaveCount(0);

        await listPage.refreshButton.click();
        await expect(listPage.refreshButton).toHaveText("자동 새로고침: 꺼짐");
    });

    test("모듈을 끄면 붙인 것을 걷고, 다시 켜면 되돌린다", async ({listPage, storage}) => {
        await storage.setModules({userinfo: false, refresh: false});
        await expect(listPage.badges).toHaveCount(0);
        await expect(listPage.refreshButton).toHaveCount(0);

        await storage.setModules({});
        await expect(listPage.badges).toHaveCount(2);
        await expect(listPage.refreshButton).toHaveCount(1);
    });

    test("차단 목록에 든 닉네임의 행을 숨기고, 목록을 비우면 바로 되돌린다", async ({listPage, storage}) => {
        const blocked = listPage.row(2);
        await expect(blocked).toBeVisible();

        await storage.set({"refresher:block:NICK": [{id: "a", content: "ㅇㅇ", isRegex: false}]});
        await expect(blocked).toHaveClass(/refresherBlocked/);
        await expect(blocked).toBeHidden();
        await expect(listPage.row(3)).toBeVisible();

        await storage.set({"refresher:block:NICK": []});
        await expect(blocked).toBeVisible();
        await expect(blocked).not.toHaveClass(/refresherBlocked/);
    });

    test("흐리게 처리를 켜면 차단한 행을 숨기지 않고 흐린다", async ({listPage, storage}) => {
        await storage.setModuleSettings("block", {blur: true});
        await storage.set({"refresher:block:ID": [{id: "a", content: "user1", isRegex: false}]});

        const blurred = listPage.row(1);
        await expect(blurred).toHaveClass(/refresherBlur/);
        await expect(blurred).not.toHaveClass(/refresherBlocked/);
        await expect(blurred).toBeVisible();
    });

    test("페이지 번호를 누르면 페이지를 다시 읽지 않고 목록만 바꾸고, 뒤로 가기로 되돌린다", async ({listPage}) => {
        const {page} = listPage;
        // 페이지를 다시 읽으면 이 값이 사라진다.
        await page.evaluate(() => document.documentElement.setAttribute("data-e2e-same-document", ""));

        await listPage.paging.getByRole("link", {name: "2", exact: true}).click();
        await expect(page).toHaveURL(/\/board\/lists\/\?id=test&page=2$/);
        await expect(listPage.rows).toHaveCount(1);
        await expect(listPage.row(51)).toContainText("2쪽 첫 글");
        // 페이징 박스도 받은 페이지 것으로 바뀐다.
        await expect(listPage.paging.locator("em")).toHaveText("2");

        await page.goBack();
        await expect(page).toHaveURL(/\/board\/lists\/\?id=test$/);
        await expect(listPage.rows).toHaveCount(3);
        await expect(listPage.paging.locator("em")).toHaveText("1");
        await expect(page.locator("html")).toHaveAttribute("data-e2e-same-document");
    });
});

test.describe("자동 새로고침", () => {
    test.beforeEach(async ({storage}) => {
        await storage.setModuleSettings("refresh", {refreshRate: 3000});
    });

    test("새 글을 맨 위에 넣고 그대로인 행은 갈아끼우지 않는다. 차단한 사람의 새 글은 가린다", async ({listPage, site, storage}) => {
        await storage.set({"refresher:block:NICK": [{id: "a", content: "차단닉", isRegex: false}]});
        // 첫 새로고침은 페이지에 있던 행을 모두 받은 행으로 바꾼다. 두 번째 요청이 왔으면 첫 교체는 끝났다 (요청은 앞 교체가 끝난 뒤에 나간다).
        await expect.poll(() => site.listRequests, {timeout: 15_000}).toBeGreaterThanOrEqual(3);
        await listPage.row(3).evaluate((row) => row.setAttribute("data-e2e-kept", ""));

        site.rows = [
            {no: 5, title: "차단된 새 글", nick: "차단닉", uid: "", ip: "5.6"},
            {no: 4, title: "네 번째 글", nick: "새닉", uid: "user4"},
            ...site.rows
        ];
        const fresh = listPage.row(4);
        await expect(fresh).toBeVisible({timeout: 15_000});
        await expect(fresh).toHaveClass(/refresherNewPost/);
        await expect(listPage.rows.nth(1)).toHaveAttribute("data-no", "4");
        // 새 행에도 유저 정보 배지가 붙는다.
        await expect(fresh.locator(".refresher-user-badges")).toHaveText("(user4)");
        await expect(listPage.row(5)).toHaveClass(/refresherBlocked/);
        await expect(listPage.row(3)).toHaveAttribute("data-e2e-kept");
    });

    test("미리보기를 연 동안에도 목록을 새로고침한다", async ({listPage, site}) => {
        await listPage.openPreview();
        await expect(listPage.frameTitle).toHaveText("[말머리] 글 3 제목");

        site.rows = [{no: 4, title: "네 번째 글", nick: "새닉", uid: "user4"}, ...site.rows];
        await expect(listPage.row(4)).toBeAttached({timeout: 15_000});
        await expect(listPage.frame).toBeVisible();
    });

    test("삭제된 글 보존을 켜면 목록에서 빠진 글을 제자리에 붉게 남긴다", async ({listPage, site, storage}) => {
        await storage.setModuleSettings("preview", {archiveArticle: true});
        site.rows = site.rows.filter(({no}) => no !== 2);

        await expect(listPage.row(2)).toHaveClass(/refresherDeleted/, {timeout: 15_000});
        await expect(listPage.rows.nth(1)).toHaveAttribute("data-no", "2");
    });

    test("목록 위에서 쉬기를 켜면 마우스가 목록에 있는 동안 새로고침하지 않는다", async ({listPage, site, storage}) => {
        await storage.setModuleSettings("refresh", {refreshRate: 3000, pauseOnHover: true});
        await listPage.rows.nth(1).hover();
        site.rows = [{no: 4, title: "네 번째 글", nick: "새닉", uid: "user4"}, ...site.rows];

        // 두 주기가 지나도 그대로다.
        await listPage.page.waitForTimeout(8000);
        await expect(listPage.row(4)).toHaveCount(0);

        await listPage.leave();
        await expect(listPage.rows.first()).toHaveAttribute("data-no", "4", {timeout: 15_000});
    });

    test("꺼 두면 새 글이 올라와도 목록을 바꾸지 않는다", async ({listPage, site}) => {
        await listPage.refreshButton.click();
        site.rows = [{no: 4, title: "네 번째 글", nick: "새닉", uid: "user4"}, ...site.rows];

        await listPage.page.waitForTimeout(8000);
        await expect(listPage.row(4)).toHaveCount(0);
    });
});

test.describe("목록 키보드", () => {
    test("J/K로 글을 고르고 Esc로 풀며, Enter로 고른 글을 미리보기로 연다", async ({listPage}) => {
        const {page, rows} = listPage;
        const selected = page.locator(".refresherSelected");
        await page.keyboard.press("j");
        await expect(rows.nth(0)).toHaveClass(/refresherSelected/);
        await page.keyboard.press("Escape");
        await expect(selected).toHaveCount(0);

        await page.keyboard.press("j");
        await page.keyboard.press("j");
        await expect(rows.nth(1)).toHaveClass(/refresherSelected/);
        await expect(selected).toHaveCount(1);
        await page.keyboard.press("k");
        await expect(rows.nth(0)).toHaveClass(/refresherSelected/);

        await page.keyboard.press("Enter");
        await expect(listPage.frameTitle).toHaveText("[말머리] 글 3 제목");
        await page.keyboard.press("Escape");
        // 미리보기를 닫아도 고른 글은 그대로다. 곧바로 누른 Esc는 닫히는 중인 창이 아니라 목록이 받아 선택을 푼다.
        await expect(rows.nth(0)).toHaveClass(/refresherSelected/);
        await page.keyboard.press("Escape");
        await expect(selected).toHaveCount(0);
        await expect(listPage.frame).toHaveCount(0);
    });
});

test.describe("읽은 글", () => {
    test("미리보기로 연 글은 닫은 뒤 목록에서 흐려지고, 모아서 저장한다", async ({listPage, storage}) => {
        await listPage.openPreview();
        await expect(listPage.frameTitle).toHaveText("[말머리] 글 3 제목");
        await listPage.page.keyboard.press("Escape");

        await expect(listPage.row(3)).toHaveClass(/refresherRead/);
        await expect(listPage.row(2)).not.toHaveClass(/refresherRead/);
        // 저장은 5초 모아서 한다 (read.ts의 SAVE_DELAY).
        await expect.poll(() => storage.get("refresher:module:preview:data"), {timeout: 10_000}).toEqual({read: ["test:3"]});
    });
});

test.describe("스텔스 모드", () => {
    test("켜면 미리보기 본문 이미지를 숨기고, 버튼으로 잠시 보였다가 끄면 되돌린다", async ({listPage, storage}) => {
        await storage.setModules({stealth: true});
        const html = listPage.page.locator("html");
        await expect(html).toHaveClass(/refresherStealth/);

        const image = (await listPage.openPreview()).locator(".refresher-preview-contents img");
        await expect(image).toBeAttached();
        await expect(image).toBeHidden();

        await listPage.page.getByRole("button", {name: "이미지 보이기"}).click();
        await expect(image).toBeVisible();
        await expect(listPage.page.getByRole("button", {name: "이미지 숨기기"})).toBeVisible();

        await storage.setModules({stealth: false});
        await expect(html).not.toHaveClass(/refresherStealth/);
        await expect(listPage.page.locator(".stealth_control_button")).toHaveCount(0);
        await expect(image).toBeVisible();
    });
});

test.describe("임시 차단", () => {
    test("디시가 빈 페이지를 주면 미리보기가 없는 페이지에서도 오버레이로 알린다", async ({page}) => {
        await page.goto("https://gall.dcinside.com/board/write/?id=test");
        await expect(page.locator("refresher-root [data-slot=toast]")).toContainText("잠시 접속을 막았습니다");
    });
});
