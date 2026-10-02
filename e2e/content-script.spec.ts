import {fakeComment, SERVICE_CODE_TAIL} from "./dcinside";
import {expect, type ExtensionStorage, test} from "./fixtures";
import type {ListPage} from "./pages/list";

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
        const frame = await listPage.openPreview();
        await expect(frame.locator("h2")).toHaveText("[말머리] 글 3 제목");
        await expect(frame.locator(".refresher-preview-contents")).toContainText("본문 3 내용입니다.");
        await expect(frame.locator(".refresher-comment")).toHaveCount(2);
        await expect(frame.getByText("스레드 1개, 총 댓글 2개")).toBeVisible();
        await expect(listPage.page).toHaveURL(/\/board\/view\/\?id=test&no=3/);

        // 정화: 본문 이미지는 lazy로, 오버레이의 Radix 버튼은 스타일이 붙어 있다.
        await expect(frame.locator(".refresher-preview-contents img")).toHaveAttribute("loading", "lazy");
        const styled = await frame.locator(".rt-BaseButton").first().evaluate((element) => getComputedStyle(element).cursor === "pointer");
        expect(styled).toBe(true);
        // IconButton 크기 규칙은 :not(.rt-variant-ghost)에 묶여 있어 ghost 규칙을 잘못 빼면 같이 빠진다 (modules/slim-radix-css).
        const icon = await frame.getByRole("button", {name: "디시콘"}).boundingBox();
        expect([icon?.width, icon?.height]).toEqual([32, 32]);

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
        // 설정은 저장소 감시로 탭에 닿는다. 닿기 전에 누르면 실제로 이동해 버리므로, 저장한 뒤 페이지를 다시 연다.
        await storage.setModuleSettings("preview", {reversePreviewKey: true});
        await listPage.page.reload();
        await listPage.refreshButton().waitFor();
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
        // 저장은 모아서 한다 (read.ts의 SAVE_DELAY 5초).
        await expect.poll(() => storage.get("refresher:module:preview:data"), {timeout: 10_000}).toEqual({read: ["test:3"]});
    });

    test("옵션에서 바꾼 설정이 열린 창에 바로 반영된다", async ({listPage, storage}) => {
        const frame = await listPage.openPreview();
        await expect(frame).toHaveAttribute("style", /--refresher-frame-width: 1200px/);
        await storage.setModuleSettings("preview", {previewWidth: 900});
        await expect(frame).toHaveAttribute("style", /--refresher-frame-width: 900px/);
    });

    test("본문 이미지를 누르면 크게 보고, Esc는 크게 보기만 닫는다", async ({listPage}) => {
        const frame = await listPage.openPreview();
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

    test("스크롤 끝에서 굴리면 안내만 띄우고, 새로 한 번 더 굴려야 다음 글로 넘어간다", async ({listPage}) => {
        const frame = await listPage.openPreview(1);
        await expect(frame.getByText("글 2 제목").first()).toBeVisible();

        const {page} = listPage;
        const box = await listPage.overlay().locator(".refresher-frame-scroll").boundingBox();
        await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
        // 끝에 닿은 그 동작(관성 포함)으로는 넘어가지 않는다.
        for (let i = 0; i < 5; i++) {
            await page.mouse.wheel(0, 2000);
            await page.waitForTimeout(50);
        }
        await expect(listPage.overlay().locator(".refresher-skip-hint")).toBeVisible();
        await expect(frame.getByText("글 2 제목").first()).toBeVisible();

        // 잠시 뒤 새로 굴리면 목록의 다음(아래) 글로 넘어간다.
        await page.waitForTimeout(400);
        await page.mouse.wheel(0, 300);
        await expect(frame.getByText("글 1 제목").first()).toBeVisible();
    });

    test("답글이 둘 이상인 스레드는 접고 펼 수 있고, 접힌 답글은 보이지 않는다", async ({listPage, site}) => {
        site.comments.push(fakeComment(12, {c_no: "10", depth: 1, ip: "3.4", memo: "답글 둘"}));
        const frame = await listPage.openPreview();
        const reply = frame.getByText("답글 둘");
        await expect(reply).toBeVisible();

        await frame.getByRole("button", {name: "답글 접기"}).click();
        // 답글은 모두 접히고 부모 댓글만 남는다.
        await expect(reply).toBeHidden();
        await expect(frame.getByText("답글", {exact: true})).toBeHidden();
        await expect(frame.getByText("댓글 하나")).toBeVisible();

        await frame.getByRole("button", {name: "답글 펼치기"}).click();
        await expect(reply).toBeVisible();
    });

    test("답글이 하나뿐인 스레드에는 접기 버튼이 없다", async ({listPage}) => {
        const frame = await listPage.openPreview();
        await expect(frame.getByText("답글", {exact: true})).toBeVisible();
        await expect(frame.getByRole("button", {name: /답글 (접기|펼치기)/})).toHaveCount(0);
    });

    test("댓글을 새로고침하면 새로 들어온 댓글만 강조한다", async ({listPage, site}) => {
        const frame = await listPage.openPreview();
        const comments = frame.locator(".refresher-comment");
        const fresh = frame.locator(".refresher-comment[data-fresh]");
        await expect(comments).toHaveCount(2);
        await expect(fresh).toHaveCount(0);

        site.comments.push(fakeComment(12, {user_id: "user2", name: "고닉", ip: "", memo: "새 댓글"}));
        await frame.getByRole("button", {name: "댓글 새로고침"}).click();

        await expect(comments).toHaveCount(3);
        await expect(fresh).toHaveCount(1);
        await expect(fresh).toContainText("새 댓글");
    });
});

test.describe("댓글 쓰기·지우기", () => {
    test("비회원 댓글은 폼에서 푼 service_code와 닉네임·비밀번호를 담아 보내고, 올라간 댓글을 다시 받는다", async ({listPage, site}) => {
        const frame = await listPage.openPreview();
        await frame.getByRole("textbox", {name: "댓글 입력"}).fill("미리보기에서 쓴 댓글");
        await frame.getByRole("button", {name: "작성"}).click();

        await expect(frame.getByText("미리보기에서 쓴 댓글", {exact: true})).toBeVisible();
        await expect(frame.getByRole("textbox", {name: "댓글 입력"})).toHaveValue("");
        expect(site.submitted).toHaveLength(1);
        const {body} = site.submitted[0]!;
        expect(body.get("service_code")).toBe(`abc${SERVICE_CODE_TAIL}`);
        expect(Object.fromEntries(["id", "no", "c_gall_id", "c_gall_no", "name", "memo"].map((key) => [key, body.get(key)]))).toEqual({
            id: "test", no: "3", c_gall_id: "test", c_gall_no: "3", name: "ㅇㅇ", memo: "미리보기에서 쓴 댓글"
        });
        // 비밀번호는 만들어 넣고, 답글이 아니면 부모 번호가 없다.
        expect(body.get("password")).toMatch(/^.{4,}$/);
        expect(body.has("c_no")).toBe(false);
    });

    test("답글은 스레드 첫 댓글 번호와 답할 댓글 번호를 같이 보낸다", async ({listPage, site}) => {
        const frame = await listPage.openPreview();
        // 답글(11)에 답한다. 부모는 스레드 첫 댓글(10)이다.
        await frame.locator(".refresher-comment").nth(1).getByRole("button", {name: "답글", exact: true}).click();
        await frame.getByRole("textbox", {name: "답글 입력"}).fill("답글에 단 답글");
        await frame.getByRole("button", {name: "작성"}).click();

        await expect(frame.getByText("답글에 단 답글", {exact: true})).toBeVisible();
        const {body} = site.submitted[0]!;
        expect([body.get("c_no"), body.get("reply_no")]).toEqual(["10", "11"]);
        // 답글을 보내면 답글 대상이 풀린다.
        await expect(frame.getByRole("textbox", {name: "댓글 입력"})).toBeVisible();
    });

    test("유동 댓글은 비밀번호를 물어 지우고, 지운 뒤 목록을 다시 받는다", async ({listPage, site}) => {
        const frame = await listPage.openPreview();
        // 대화상자는 뜨는 동안 페이지를 멈추므로 누르기 전에 처리기를 건다.
        const dialogs: string[] = [];
        listPage.page.once("dialog", (dialog) => {
            dialogs.push(dialog.type());
            void dialog.accept("pw1234");
        });
        await frame.locator(".refresher-comment").nth(1).getByRole("button", {name: "댓글 삭제"}).click();

        await expect(listPage.toast()).toContainText("댓글을 삭제했습니다.");
        await expect(frame.locator(".refresher-comment").nth(1)).toHaveAttribute("data-deleted");
        expect(dialogs).toEqual(["prompt"]);
        const {path, body} = site.submitted[0]!;
        expect(path).toBe("/board/comment/comment_delete_submit");
        expect(Object.fromEntries(["id", "no", "re_no", "mode", "re_password"].map((key) => [key, body.get(key)]))).toEqual({
            id: "test", no: "3", re_no: "11", mode: "del", re_password: "pw1234"
        });
    });

    test("비밀번호 입력을 취소하면 아무것도 보내지 않는다", async ({listPage, site}) => {
        const frame = await listPage.openPreview();
        const dismissed = new Promise<void>((resolve) => listPage.page.once("dialog", (dialog) => void dialog.dismiss().then(resolve)));
        await frame.locator(".refresher-comment").nth(1).getByRole("button", {name: "댓글 삭제"}).click();
        await dismissed;

        // 대화상자가 닫힌 뒤에도 요청이 없고 댓글은 그대로다.
        await listPage.page.waitForTimeout(500);
        expect(site.submitted).toEqual([]);
        await expect(frame.locator(".refresher-comment").nth(1)).not.toHaveAttribute("data-deleted");
    });
});

test.describe("자동 새로고침", () => {
    test("새 글이 올라오면 맨 위에 넣고, 차단한 사람의 새 글은 가린다", async ({listPage, site, storage}) => {
        await storage.set({"refresher:block:NICK": [{content: "차단닉", isRegex: false}]});
        await storage.setModuleSettings("refresh", {refreshRate: 3000});
        site.rows = [
            {no: 5, title: "차단된 새 글", nick: "차단닉", uid: "", ip: "5.6"},
            {no: 4, title: "네 번째 글", nick: "새닉", uid: "user4"},
            ...site.rows
        ];

        const rows = listPage.rows();
        await expect(rows.nth(1)).toContainText("네 번째 글", {timeout: 15_000});
        await expect(rows.nth(1)).toHaveClass(/refresherNewPost/);
        await expect(rows.nth(0)).toHaveClass(/refresherBlocked/);
        // 새 행에도 유저 정보 배지가 붙는다.
        await expect(rows.nth(1).locator(".refresher-user-badges")).toHaveText("(user4)");
    });

    test("삭제된 글 보존을 켜면 목록에서 빠진 글을 붉게 남긴다", async ({listPage, site, storage}) => {
        await storage.setModuleSettings("preview", {archiveArticle: true});
        await storage.setModuleSettings("refresh", {refreshRate: 3000});
        site.rows = site.rows.filter((row) => row.no !== 2);

        const deleted = listPage.page.locator(".gall_list tr[data-no=\"2\"]");
        await expect(deleted).toHaveClass(/refresherDeleted/, {timeout: 15_000});
        // 자리는 그대로다 (3과 1 사이).
        await expect(listPage.rows().nth(1)).toHaveAttribute("data-no", "2");
    });

    test("목록 위에 마우스가 있으면 새로고침하지 않는다", async ({listPage, site, storage}) => {
        await storage.setModuleSettings("refresh", {refreshRate: 3000, pauseOnHover: true});
        await listPage.rows().nth(1).hover();
        site.rows = [{no: 4, title: "네 번째 글", nick: "새닉", uid: "user4"}, ...site.rows];

        // 두 주기가 지나도 그대로다. 이 설정이 꺼진(기본값) 위 테스트들은 이 시간 안에 새 글을 넣는다.
        await listPage.page.waitForTimeout(7000);
        await expect(listPage.rows().first()).toHaveAttribute("data-no", "3");

        await listPage.leave();
        await expect(listPage.rows().first()).toHaveAttribute("data-no", "4", {timeout: 15_000});
    });
});

test.describe("미니 미리보기", () => {
    /** 미니 미리보기를 켜고 첫 제목에 카드가 뜰 때까지 올린다. 설정은 저장소 감시로 탭에 닿으므로 닿을 때까지 다시 올린다. */
    const showFirstMini = async (listPage: ListPage, storage: ExtensionStorage) => {
        await storage.setModuleSettings("preview", {tooltipMode: true});
        await expect(async () => {
            await listPage.leave();
            await listPage.titles().first().hover();
            await expect(listPage.mini()).toHaveCount(1, {timeout: 1000});
        }).toPass();
    };

    test("켜면 제목에 마우스를 올릴 때 카드가 뜨고, 떠나면 닫힌다", async ({listPage, storage}) => {
        await showFirstMini(listPage, storage);
        await expect(listPage.mini().locator(".refresher-mini-contents")).toContainText("본문 3 내용입니다.");

        await listPage.leave();
        await expect(listPage.mini()).toHaveCount(0);
    });

    test("다른 제목으로 옮기면 카드가 그 글로 바뀐다", async ({listPage, storage}) => {
        await showFirstMini(listPage, storage);
        await listPage.titles().nth(1).hover();
        await expect(listPage.mini().locator(".refresher-mini-contents")).toContainText("본문 2 내용입니다.");
    });

    test("목록을 훑고 지나간 제목은 글을 받지 않고, 멈춘 제목만 받는다", async ({listPage, storage}) => {
        await showFirstMini(listPage, storage);
        await listPage.leave();
        const viewed: string[] = [];
        listPage.page.on("request", (request) => {
            const url = new URL(request.url());
            if (url.pathname.startsWith("/board/view")) viewed.push(url.searchParams.get("no") ?? "");
        });

        for (const index of [0, 1, 2]) await listPage.titles().nth(index).hover();
        await expect(listPage.mini().locator(".refresher-mini-contents")).toContainText("본문 1 내용입니다.");
        expect(viewed).toEqual(["1"]);
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

test.describe("메모", () => {
    test("버블에서 메모 창을 열어 저장하면 저장소에 남고 목록 배지에 붙는다", async ({listPage, storage}) => {
        await listPage.writers().first().click({button: "right"});
        await listPage.bubble().getByRole("button", {name: "메모"}).click();

        const dialog = listPage.overlay().getByRole("dialog");
        await expect(dialog.getByText("메모", {exact: true}).first()).toBeVisible();
        await dialog.getByRole("textbox").first().fill("테스트 메모");
        // 오버레이(shadow DOM) 안에서도 Tab·Shift+Tab이 창 밖(디시 페이지)으로 나가지 않는다.
        const focusInside = () => dialog.evaluate((element) => element.contains((element.getRootNode() as ShadowRoot).activeElement) && document.activeElement?.tagName === "REFRESHER-ROOT");
        for (const key of ["Tab", "Shift+Tab"]) {
            for (let i = 0; i < 12; i++) {
                await listPage.page.keyboard.press(key);
                expect(await focusInside()).toBe(true);
            }
        }
        await dialog.getByRole("button", {name: "저장"}).click();

        await expect(dialog).toHaveCount(0);
        await expect(listPage.toast()).toContainText("메모를 저장했습니다.");
        await expect.poll(() => storage.get("refresher:memo:UID")).toMatchObject({user3: {text: "테스트 메모"}});
        await expect(listPage.rows().first()).toContainText("테스트 메모");
    });
});

test.describe("글 페이지 댓글", () => {
    const SAME = "같은 내용의 댓글입니다";

    test("같은 댓글은 첫 댓글에 배지를 달고 접는다. 차단하면 남은 댓글로 다시 센다", async ({context, site, storage}) => {
        await storage.setModuleSettings("block", {foldDuplicate: true, duplicateCount: 3});
        site.pageComments = ["가", "나", "다"].map((name, index) => fakeComment(20 + index, {name, memo: SAME}));
        const page = await context.newPage();
        await page.goto("https://gall.dcinside.com/board/view/?id=test&no=3");
        const items = page.locator(".cmt_list > li");

        await expect(items.nth(0).locator(".refresherDuplicateBadge")).toHaveText("같은 댓글 ×3");
        await expect(items.nth(1)).toHaveClass(/refresherDuplicate/);
        await expect(items.nth(2)).toBeHidden();

        // 첫 댓글을 차단하면 둘만 남아 기준(3번) 아래다. 접었던 댓글을 다시 보이고 배지도 뗀다.
        await storage.set({"refresher:block:NICK": [{content: "가", isRegex: false}]});
        await expect(items.nth(0)).toBeHidden();
        await expect(items.nth(1)).toBeVisible();
        await expect(items.nth(2)).toBeVisible();
        await expect(page.locator(".refresherDuplicateBadge")).toHaveCount(0);
    });

    test("깡계로 숨긴 댓글은 세지 않아, 같은 내용의 다른 댓글까지 사라지지 않는다", async ({context, site, storage}) => {
        await storage.setModuleSettings("block", {foldDuplicate: true, duplicateCount: 3});
        await storage.setModuleSettings("userinfo", {checkRatio: true, alarmRatio: 10, lowActivityAction: "hide"});
        // 첫 댓글 작성자는 글댓비를 받아 둔 깡계다.
        await storage.set({"refresher:module:userinfo:data": {ratio: {low1: {article: 1, comment: 2, date: Date.now()}}}});
        site.pageComments = [
            fakeComment(20, {name: "깡계", user_id: "low1", ip: "", memo: SAME}),
            fakeComment(21, {name: "나", memo: SAME}),
            fakeComment(22, {name: "다", memo: SAME})
        ];
        const page = await context.newPage();
        await page.goto("https://gall.dcinside.com/board/view/?id=test&no=3");
        const items = page.locator(".cmt_list > li");

        await expect(items.nth(0)).toHaveClass(/refresherLowActivityHide/);
        await expect(items.nth(1)).toBeVisible();
        await expect(items.nth(2)).toBeVisible();
        await expect(page.locator(".refresherDuplicateBadge")).toHaveCount(0);
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

        const reveal = listPage.page.getByRole("button", {name: "이미지 보이기"});
        await reveal.click();
        await expect(image).toBeVisible();
        await expect(listPage.page.getByRole("button", {name: "이미지 숨기기"})).toBeVisible();

        await storage.setModules({stealth: false});
        await expect(html).not.toHaveClass(/refresherStealth/);
        await expect(listPage.page.locator(".stealth_control_button")).toHaveCount(0);
        await expect(image).toBeVisible();
    });
});

test.describe("목록·본문이 아닌 페이지", () => {
    test("미리보기가 없는 페이지에서도 오버레이가 뜬다 (임시 차단 안내)", async ({context}) => {
        const page = await context.newPage();
        await page.goto("https://gall.dcinside.com/board/write/?id=test");
        await expect(page.locator("refresher-root").locator(".refresher-toast")).toContainText("잠시 접속을 막았습니다");
    });
});
