import {DCCON, fakeComment, SERVICE_CODE_TAIL} from "./dcinside";
import {expect, test} from "./fixtures";
import {viewPage} from "./pages/gallery";

const LIST_URL = /\/board\/lists\/\?id=test$/;
const viewUrl = (no: number): RegExp => new RegExp(`/board/view/\\?id=test&no=${no}&page=1$`);

test.describe("미리보기", () => {
    test("제목을 우클릭하면 창을 띄워 본문·댓글을 그리고, 글 주소를 쌓았다가 Esc로 닫으면 목록으로 돌아간다", async ({listPage}) => {
        const {page, frame} = listPage;
        await listPage.openPreview();
        await expect(listPage.frameTitle).toHaveText("[말머리] 글 3 제목");
        await expect(frame.locator(".refresher-preview-contents")).toContainText("본문 3 내용입니다.");
        await expect(listPage.comments).toHaveCount(2);
        await expect(frame.getByText("스레드 1개, 총 댓글 2개", {exact: true})).toBeVisible();
        await expect(page).toHaveURL(viewUrl(3));
        await expect(page).toHaveTitle("세 번째 글 - 테스트 갤러리");

        // 본문은 정화해 넣는다 (이미지는 lazy). shadow 안의 Tailwind 스타일도 걸린다 (base-vega의 아이콘 버튼은 size-9).
        await expect(frame.locator(".refresher-preview-contents img")).toHaveAttribute("loading", "lazy");
        const icon = await frame.getByRole("button", {name: "디시콘", exact: true}).boundingBox();
        expect([icon?.width, icon?.height]).toEqual([36, 36]);

        await page.keyboard.press("Escape");
        await expect(frame).toHaveCount(0);
        await expect(page).toHaveURL(LIST_URL);
        await expect(page).toHaveTitle("테스트 갤러리");
    });

    test("미리보기 주소에서 새로고침하면 글 페이지로 남고, 그 항목의 미리보기 표시를 지운다", async ({listPage}) => {
        const {page} = listPage;
        await listPage.openPreview();
        await expect(page).toHaveURL(viewUrl(3));
        await page.reload();
        await expect(viewPage(page).body).toContainText("본문 3 내용입니다.");
        // 표시가 남으면 목록으로 뒤로 갔다 앞으로 올 때(bfcache 없이) 다시 목록·미리보기로 바뀐다.
        await expect.poll(() => page.evaluate(() => history.state)).toBeNull();
    });

    test("창을 열어 페이지 스크롤을 잠가도 스크롤바 자리를 남겨 뒤 페이지가 옆으로 밀리지 않고, 스크롤바가 없던 페이지에는 자리를 만들지 않는다", async ({listPage, browserName}) => {
        test.skip(browserName === "firefox", "headless 파이어폭스는 자리를 차지하는 스크롤바를 그리지 않는다.");
        const {page, frame} = listPage;
        const layout = () => page.evaluate(() => ({width: document.body.getBoundingClientRect().width, gutter: document.documentElement.style.scrollbarGutter}));
        const short = await layout();
        await listPage.openPreview();
        await expect(frame).toBeVisible();
        expect(await layout()).toEqual(short);
        await page.keyboard.press("Escape");
        await expect(frame).toHaveCount(0);

        // 페이지를 늘려 스크롤바를 세운다 (fixtures에서 크로미엄의 스크롤바 숨김을 끈다).
        await page.evaluate(() => document.body.style.setProperty("min-height", "300vh"));
        const long = await layout();
        expect(long.width).toBeLessThan(short.width);
        await listPage.openPreview();
        await expect(frame).toBeVisible();
        expect(await layout()).toEqual({width: long.width, gutter: "stable"});
        await page.keyboard.press("Escape");
        await expect(frame).toHaveCount(0);
        expect(await layout()).toEqual(long);
    });

    test("PageDown·PageUp으로 옆 글로 넘기고, 뒤로 가기는 앞서 본 글을 다시 열며, 닫으면 쌓은 주소를 모두 걷는다", async ({listPage}) => {
        const {page} = listPage;
        const shows = async (no: number): Promise<void> => {
            await expect(listPage.frameTitle).toHaveText(`[말머리] 글 ${no} 제목`);
            await expect(page).toHaveURL(viewUrl(no));
            await expect(listPage.comments).toHaveCount(2);
        };
        await listPage.openPreview();
        await shows(3);

        await page.keyboard.press("PageDown");
        await shows(2);
        await page.keyboard.press("PageDown");
        await shows(1);
        await page.keyboard.press("PageUp");
        await shows(2);

        await page.goBack();
        await shows(1);

        await page.keyboard.press("Escape");
        await expect(listPage.frame).toHaveCount(0);
        await expect(page).toHaveURL(LIST_URL);
        // 목록 앞의 기록(빈 탭)으로 돌아가지 않았다.
        await expect(listPage.refreshButton).toBeVisible();
    });

    test("PageDown을 누르고 있어도 반복 입력으로는 넘기지 않는다", async ({listPage}) => {
        const {page} = listPage;
        await listPage.openPreview();
        await expect(listPage.frameTitle).toHaveText("[말머리] 글 3 제목");

        // 두 번째 down은 Playwright가 반복 입력(repeat)으로 보낸다.
        await page.keyboard.down("PageDown");
        await page.keyboard.down("PageDown");
        await page.keyboard.up("PageDown");
        await expect(listPage.frameTitle).toHaveText("[말머리] 글 2 제목");
        await expect(page).toHaveURL(viewUrl(2));
    });

    test("받는 중에 넘기거나 닫아 끊은 요청은 콘솔에 오류를 남기지 않는다", async ({listPage, context}) => {
        const {page} = listPage;
        // 본문·댓글 응답을 창을 닫을 때까지 붙잡아 늘 받는 도중에 끊기게 한다. 파이어폭스에서 content.fetch의 AbortError가 처리되지 않은 오류로 남았다.
        let stall = Promise.withResolvers<void>();
        const settled: Promise<void>[] = [];
        await context.route(/\/board\/(view|comment)\//, (route) => {
            const handled = stall.promise.then(() => route.fallback()).catch(() => {});
            settled.push(handled);
            return handled;
        });
        const postRequest = (no: number) => page.waitForRequest(new RegExp(`/board/view/\\?id=test&no=${no}$`));
        const scroller = listPage.overlay.locator(".refresher-frame-scroll");
        // 마지막 행(1번 글)은 PageDown으로 넘어갈 글이 없다.
        for (const no of [3, 2]) {
            stall = Promise.withResolvers();
            let requested = postRequest(no);
            await listPage.openPreview(3 - no);
            await requested;
            // PageDown 처리기는 스크롤 칸 포커스와 같은 effect 차례에 붙으므로 포커스를 본 뒤에 누른다.
            await expect(scroller).toBeFocused();
            requested = postRequest(no - 1);
            await page.keyboard.press("PageDown");
            await requested;
            await page.keyboard.press("Escape");
            await expect(listPage.frame).toHaveCount(0);
            stall.resolve();
        }
        // 끊긴 응답이 다 돌아올 때까지 기다린다. 오류는 errors 픽스처가 본다.
        await Promise.all(settled);
    });

    test("뒤로 가기로 닫으면 목록 주소로 돌아간다", async ({listPage}) => {
        await listPage.openPreview();
        await expect(listPage.frameTitle).toHaveText("[말머리] 글 3 제목");

        await listPage.page.goBack();
        await expect(listPage.frame).toHaveCount(0);
        await expect(listPage.page).toHaveURL(LIST_URL);
    });

    test("방금 연 글을 닫았다 다시 열면 본문·댓글을 다시 받지 않고, 댓글 새로고침은 받는다 (#273)", async ({listPage}) => {
        const requests: string[] = [];
        listPage.page.on("request", (request) => {
            const {pathname} = new URL(request.url());
            if (pathname.startsWith("/board/view") || pathname.startsWith("/board/comment")) requests.push(pathname);
        });

        for (let i = 0; i < 3; i++) {
            await listPage.openPreview();
            await expect(listPage.comments).toHaveCount(2);
            // Base UI의 Esc 리스너는 스크롤 칸 포커스와 같은 effect 차례에 붙으므로 포커스를 본 뒤에 누른다.
            await expect(listPage.overlay.locator(".refresher-frame-scroll")).toBeFocused();
            await listPage.page.keyboard.press("Escape");
            await expect(listPage.frame).toHaveCount(0);
        }
        expect(requests).toEqual(["/board/view/", "/board/comment/"]);

        await listPage.openPreview();
        await listPage.frame.getByRole("button", {name: "댓글 새로고침", exact: true}).click();
        await expect.poll(() => requests).toEqual(["/board/view/", "/board/comment/", "/board/comment/"]);
    });

    test("캐시로 다시 연 글은 본문을 먼저 그리고 댓글은 다음 프레임에 그린다", async ({listPage}) => {
        const {page} = listPage;
        await listPage.openPreview();
        await expect(listPage.comments).toHaveCount(2);
        await expect(listPage.overlay.locator(".refresher-frame-scroll")).toBeFocused();
        await page.keyboard.press("Escape");
        await expect(listPage.frame).toHaveCount(0);

        // 본문이 들어온 뒤 첫 프레임에 그려진 댓글 수를 잰다. 댓글이 본문과 같이 그려지면 그 프레임까지 본문이 보이지 않는다.
        const atFirstFrame = page.evaluate(() => new Promise<number>((resolve) => {
            const root = document.querySelector("refresher-root")!.shadowRoot!;
            const observer = new MutationObserver(() => {
                if (!root.querySelector(".refresher-preview-contents")?.childElementCount) return;
                observer.disconnect();
                requestAnimationFrame(() => resolve(root.querySelectorAll(".refresher-comment").length));
            });
            observer.observe(root, {childList: true, subtree: true});
        }));
        await listPage.openPreview();
        expect(await atFirstFrame).toBe(0);
        await expect(listPage.comments).toHaveCount(2);
    });

    test("댓글을 받지 못하면 댓글 칸에 다시 시도 안내를 두고, 누르면 다시 받는다", async ({listPage, context, errors}) => {
        let fail = true;
        await context.route(/\/board\/comment\//, (route) => (fail ? route.fulfill({status: 500}) : route.fallback()));
        const {frame} = listPage;
        const failed = frame.getByRole("alert").filter({hasText: "댓글을 불러오지 못했습니다."});
        await listPage.openPreview();
        await expect(failed).toBeVisible();
        await expect(frame.getByRole("button", {name: "댓글 새로고침", exact: true})).toBeVisible();

        fail = false;
        await failed.getByRole("button", {name: "다시 시도", exact: true}).click();
        await expect(listPage.comments).toHaveCount(2);
        await expect(failed).toHaveCount(0);
        // 일부러 낸 실패는 브라우저(500 응답)와 컨트롤러가 콘솔에 남긴다. 그것만 걷어 낸다.
        errors.splice(0, errors.length, ...errors.filter((error) => !/500|Comment load failed/.test(error)));
    });

    test("댓글 수를 우클릭하면 댓글만 보기로 열고, 좌클릭은 원래대로 글로 간다", async ({listPage}) => {
        const reply = listPage.replyCounts.first();
        await reply.click({button: "right"});
        await expect(listPage.frame.getByRole("button", {name: /댓글만 표시 중입니다/})).toBeVisible();
        await expect(listPage.comments).toHaveCount(2);

        await listPage.page.keyboard.press("Escape");
        await expect(listPage.frame).toHaveCount(0);
        await reply.click();
        await expect(listPage.page).toHaveURL(/\/board\/view\/\?id=test&no=3&t=cv$/);
    });

    test("키 반전을 켜면 좌클릭이 미리보기를 연다", async ({listPage, storage}) => {
        // 설정은 저장소 감시로 탭에 닿는다. 닿기 전에 누르면 실제로 이동하므로 저장한 뒤 페이지를 다시 연다.
        await storage.setModuleSettings("preview", {reversePreviewKey: true});
        await listPage.page.reload();
        await listPage.refreshButton.waitFor();

        await listPage.titles.first().click();
        await expect(listPage.frameTitle).toHaveText("[말머리] 글 3 제목");
        await expect(listPage.page).toHaveURL(viewUrl(3));
    });

    test("본문 이미지를 누르면 크게 보고, Esc는 크게 보기만 닫는다", async ({listPage}) => {
        const frame = await listPage.openPreview();
        const image = frame.locator(".refresher-preview-contents img");
        await expect(image).toHaveJSProperty("complete", true);
        await image.click({force: true});

        const viewer = listPage.overlay.locator(".refresher-viewer");
        await expect(viewer.locator("img")).toHaveAttribute("src", /viewimage\.php\?id=test&no=3/);
        // 원본 보기는 디시 원본 주소(imgPop)가 있는 이미지에만 있다.
        await expect(viewer.getByRole("link", {name: "원본 보기"})).toHaveCount(0);

        // 오버레이(shadow DOM) 안에서도 Tab·Shift+Tab이 뒤의 미리보기나 디시 페이지로 나가지 않는다.
        await expect(viewer.getByRole("button", {name: "닫기"})).toBeFocused();
        const focusInside = () => viewer.evaluate((element) => document.activeElement?.tagName === "REFRESHER-ROOT" && element.contains((element.getRootNode() as ShadowRoot).activeElement));
        for (const key of ["Tab", "Shift+Tab"]) {
            for (let i = 0; i < 3; i++) {
                await listPage.page.keyboard.press(key);
                expect(await focusInside()).toBe(true);
            }
        }

        await listPage.page.keyboard.press("Escape");
        await expect(viewer).toHaveCount(0);
        await expect(frame).toBeVisible();
        // 곧바로 누른 다음 Esc는 닫힌 크게 보기가 아니라 미리보기가 받는다.
        await listPage.page.keyboard.press("Escape");
        await expect(frame).toHaveCount(0);
    });

    test("본문 이미지는 키보드로 골라 Enter로 크게 본다", async ({listPage}) => {
        const frame = await listPage.openPreview();
        const image = frame.getByRole("button", {name: "이미지 크게 보기"});
        await expect(image).toHaveJSProperty("complete", true);
        await image.focus();
        await listPage.page.keyboard.press("Enter");

        const viewer = listPage.overlay.locator(".refresher-viewer");
        await expect(viewer.locator("img")).toHaveAttribute("src", /viewimage\.php\?id=test&no=3/);
    });

    test("세로로 긴 이미지는 크게 보기에서 높이에 맞춰 줄이지 않고 폭 그대로 세로로 스크롤한다", async ({listPage}) => {
        await listPage.page.context().route(/viewimage\.php/, (route) => route.fulfill({
            contentType: "image/svg+xml",
            body: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="2000"><rect width="100" height="2000"/></svg>`
        }));
        const frame = await listPage.openPreview();
        const image = frame.locator(".refresher-preview-contents img");
        await expect(image).toHaveJSProperty("complete", true);
        await image.click({force: true});

        const viewer = listPage.overlay.locator(".refresher-viewer");
        await expect.poll(async () => (await viewer.locator("img").boundingBox())?.height).toBe(2000);
        expect(await viewer.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    });

    test("창 안의 Tab은 끝에서 처음으로 돌아가 창 밖으로 나가지 않는다", async ({listPage}) => {
        const {page} = listPage;
        const frame = await listPage.openPreview();
        const scroll = listPage.overlay.locator(".refresher-frame-scroll");
        await expect(scroll).toBeFocused();
        const focusInside = () => scroll.evaluate((el) => el.contains((el.getRootNode() as ShadowRoot).activeElement));

        // 창 안 마지막 Tab 정지점(댓글로)에서 Tab을 누르면 창 안 첫 정지점(글쓴이 닉네임)으로 간다.
        const last = frame.getByRole("button", {name: "댓글로", exact: true});
        await last.focus();
        await page.keyboard.press("Tab");
        await expect(frame.locator(".refresher-user button").first()).toBeFocused();
        expect(await focusInside()).toBe(true);
        await page.keyboard.press("Shift+Tab");
        await expect(last).toBeFocused();
    });

    test("스크롤 끝에서 굴리면 안내만 띄우고, 새로 한 번 더 굴려야 다음 글로 넘어간다", async ({listPage}) => {
        const {page} = listPage;
        await listPage.openPreview(1);
        await expect(listPage.frameTitle).toHaveText("[말머리] 글 2 제목");

        const scroll = listPage.overlay.locator(".refresher-frame-scroll");
        const box = await scroll.boundingBox();
        await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
        // 끝에 닿은 그 동작(관성 포함)으로는 넘어가지 않는다. 동작 하나는 휠 사이가 250ms 안이어야 해서 한 번에 보낸다.
        // 실제 휠로 굴리고 끝에 닿기를 기다리면 느린 환경에서 그 사이가 벌어져 이어지는 휠이 새 동작이 되고 다음 글로 넘어간다.
        await scroll.evaluate((element) => {
            const wheel = (deltaY: number) => element.dispatchEvent(new WheelEvent("wheel", {deltaY, bubbles: true, cancelable: true}));
            wheel(100);
            element.scrollTop = element.scrollHeight;
            for (let i = 0; i < 4; i++) wheel(2000);
        });
        await expect(listPage.overlay.locator(".refresher-skip-hint")).toBeVisible();
        await expect(listPage.frameTitle).toHaveText("[말머리] 글 2 제목");

        // 휠 사이가 250ms보다 벌어져야 새 동작이다. 간격은 휠 이벤트의 timeStamp로 재므로 page.clock으로 넘길 수 없어 실제로 기다린다.
        await page.waitForTimeout(400);
        await page.mouse.wheel(0, 300);
        await expect(listPage.frameTitle).toHaveText("[말머리] 글 1 제목");
    });
});

test.describe("미리보기 댓글", () => {
    test("답글이 둘 이상인 스레드는 접고 펼 수 있다", async ({listPage, site}) => {
        site.comments.push(fakeComment(12, {c_no: "10", depth: 1, ip: "3.4", memo: "답글 둘"}));
        const frame = await listPage.openPreview();
        const second = frame.getByText("답글 둘", {exact: true});
        await expect(second).toBeVisible();

        // 접기 버튼은 이름을 바꾸지 않고 aria-expanded로 상태를 알린다.
        const toggle = frame.getByRole("button", {name: "고닉 댓글의 답글 2개", exact: true});
        await expect(toggle).toHaveAttribute("aria-expanded", "true");
        await toggle.click();
        await expect(toggle).toHaveAttribute("aria-expanded", "false");
        await expect(second).toBeHidden();
        await expect(frame.getByText("답글", {exact: true})).toBeHidden();
        await expect(frame.getByText("댓글 하나", {exact: true})).toBeVisible();

        await toggle.click();
        await expect(toggle).toHaveAttribute("aria-expanded", "true");
        await expect(second).toBeVisible();
    });

    test("최신순으로 고르면 스레드만 거꾸로 세우고 답글은 첫 댓글 아래에 둔다", async ({listPage, site}) => {
        site.comments.push(fakeComment(12, {user_id: "user2", name: "고닉", ip: "", memo: "새 댓글"}));
        const frame = await listPage.openPreview();
        const memos = listPage.comments.locator(".refresher-html");
        await expect(memos).toHaveText(["댓글 하나", "답글", "새 댓글"]);

        const newest = frame.getByRole("button", {name: "최신순", exact: true});
        await newest.click();
        await expect(newest).toHaveAttribute("aria-pressed", "true");
        await expect(memos).toHaveText(["새 댓글", "댓글 하나", "답글"]);

        await frame.getByRole("button", {name: "등록순", exact: true}).click();
        await expect(memos).toHaveText(["댓글 하나", "답글", "새 댓글"]);
    });

    test("답글순으로 고르면 답글이 많은 스레드를 먼저 둔다", async ({listPage, site}) => {
        site.comments.push(
            fakeComment(12, {memo: "새 댓글"}),
            fakeComment(13, {c_no: "12", depth: 1, memo: "새 답글 1"}),
            fakeComment(14, {c_no: "12", depth: 1, memo: "새 답글 2"})
        );
        const frame = await listPage.openPreview();
        const memos = listPage.comments.locator(".refresher-html");
        await expect(memos).toHaveText(["댓글 하나", "답글", "새 댓글", "새 답글 1", "새 답글 2"]);

        await frame.getByRole("button", {name: "답글순", exact: true}).click();
        await expect(memos).toHaveText(["새 댓글", "새 답글 1", "새 답글 2", "댓글 하나", "답글"]);
    });

    test("댓글을 새로고침하면 새로 들어온 댓글만 강조한다", async ({listPage, site}) => {
        const frame = await listPage.openPreview();
        const fresh = frame.locator(".refresher-comment[data-fresh]");
        await expect(listPage.comments).toHaveCount(2);
        await expect(fresh).toHaveCount(0);

        site.comments.push(fakeComment(12, {user_id: "user2", name: "고닉", ip: "", memo: "새 댓글"}));
        await frame.getByRole("button", {name: "댓글 새로고침", exact: true}).click();
        await expect(listPage.comments).toHaveCount(3);
        await expect(fresh).toHaveCount(1);
        await expect(fresh).toContainText("새 댓글");
    });

    test("차단·유저 정보 모듈이 켜져 있는 동안만 그 설정대로 댓글을 가리고 작성자 아이디를 칠한다", async ({listPage, storage}) => {
        await storage.setModuleSettings("block", {blur: true});
        await storage.setModuleSettings("userinfo", {uidColor: "#123456"});
        await storage.set({"refresher:block:ID": [{id: "a", content: "user1", isRegex: false}]});
        const frame = await listPage.openPreview();
        const blocked = listPage.comments.first();
        const uid = frame.getByText("(user3)", {exact: true});
        await expect(blocked).toHaveAttribute("data-blocked", "blur");
        await expect(uid).toHaveCSS("color", "rgb(18, 52, 86)");

        await storage.setModules({block: false, userinfo: false});
        await expect(blocked).not.toHaveAttribute("data-blocked");
        await expect(uid).not.toHaveCSS("color", "rgb(18, 52, 86)");
    });

    test("숨김 차단한 댓글은 댓글 머리에서 이 글에서만 펼쳐 보고 다시 숨긴다", async ({listPage, storage}) => {
        await storage.setModuleSettings("block", {blur: false, replyRemove: false});
        await storage.set({"refresher:block:ID": [{id: "a", content: "user1", isRegex: false}]});
        const frame = await listPage.openPreview();
        await expect(listPage.comments).toHaveCount(1);
        await expect(frame.getByText("스레드 1개, 총 댓글 2개 (차단 1개)")).toBeVisible();

        await frame.getByRole("button", {name: "가린 댓글 보기", exact: true}).click();
        await expect(listPage.comments).toHaveCount(2);
        await expect(listPage.comments.first()).toHaveAttribute("data-blocked", "hide");
        await expect(listPage.comments.first()).toHaveCSS("opacity", "0.35");

        await frame.getByRole("button", {name: "다시 숨기기", exact: true}).click();
        await expect(listPage.comments).toHaveCount(1);
    });

    test("깡계 숨기기는 미리보기 댓글도 가리고 가린 댓글 보기로 펼친다", async ({listPage, storage}) => {
        await storage.setModuleSettings("userinfo", {checkRatio: true, alarmRatio: 10, lowActivityAction: "hide"});
        // 첫 댓글 작성자(user1)는 글댓비를 받아 둔 깡계다.
        await storage.set({"refresher:module:userinfo:data": {ratio: {user1: {article: 1, comment: 2, date: Date.now()}}}});
        const frame = await listPage.openPreview();
        await expect(listPage.comments).toHaveCount(1);
        await expect(frame.getByText("스레드 1개, 총 댓글 2개 (깡계 1개)")).toBeVisible();

        await frame.getByRole("button", {name: "가린 댓글 보기", exact: true}).click();
        await expect(listPage.comments).toHaveCount(2);
        await expect(listPage.comments.first()).toHaveAttribute("data-blocked", "hide");
    });

    test("글 댓글의 줄바꿈은 그대로 보인다", async ({listPage, site}) => {
        const frame = await listPage.openPreview();
        site.comments.push(fakeComment(12, {user_id: "user2", name: "고닉", ip: "", memo: "첫 줄\n둘째 줄"}));
        await frame.getByRole("button", {name: "댓글 새로고침", exact: true}).click();
        const body = listPage.comments.last().locator(".refresher-comment-html");
        await expect(body).toHaveText("첫 줄\n둘째 줄", {useInnerText: true});
        await expect(body.locator("br")).toHaveCount(0);
    });

    test("글자콘은 화면 근처에 온 것만 크기를 맞춘다", async ({listPage, site}) => {
        const txtcon = "<div class=\"coment_dccon_txt cbg_ffffff\"><p class=\"txtcon_txt ctxt_333333\">ㄹㅇ</p></div>";
        site.comments = Array.from({length: 200}, (_, index) => fakeComment(100 + index, index === 0 || index === 199 ? {memo: txtcon} : {}));
        await listPage.openPreview();
        await expect(listPage.comments).toHaveCount(200);
        // 맞춘 글자콘은 잴 span으로 글을 감싼다.
        const fitted = (index: number) => listPage.comments.nth(index).locator(".txtcon_txt > span");
        await expect(fitted(0)).toHaveCount(1);
        await expect(fitted(199)).toHaveCount(0);

        await listPage.comments.nth(199).scrollIntoViewIfNeeded();
        await expect(fitted(199)).toHaveCount(1);
    });

    test("스레드가 많으면 앞의 일부를 먼저 그리고 나머지를 이어 그린다", async ({listPage, site}) => {
        site.comments = Array.from({length: 1000}, (_, index) => fakeComment(100 + index));
        // 댓글이 처음 들어온 순간에 그려진 댓글 수를 잰다. 오버레이는 처음 쓸 때(우클릭을 누를 때) 붙으므로 붙기를 기다렸다가 지켜본다.
        const first = listPage.page.evaluate(() => new Promise<number>((resolve) => {
            const watch = (root: ShadowRoot): void => {
                const observer = new MutationObserver(() => {
                    const count = root.querySelectorAll(".refresher-comment").length;
                    if (!count) return;
                    observer.disconnect();
                    resolve(count);
                });
                observer.observe(root, {childList: true, subtree: true});
            };
            const find = (): void => {
                const root = document.querySelector("refresher-root")?.shadowRoot;
                if (root) watch(root);
                else setTimeout(find);
            };
            find();
        }));
        const frame = await listPage.openPreview();
        expect(await first).toBeLessThan(1000);
        await expect(listPage.comments).toHaveCount(1000);
        // 개수 요약은 처음부터 모든 댓글을 센다.
        await expect(frame.getByText("스레드 1000개, 총 댓글 1000개")).toBeVisible();
    });

    test("다 그리기 전에 누른 End는 마지막 댓글까지 간다", async ({listPage, site}) => {
        site.comments = Array.from({length: 1000}, (_, index) => fakeComment(100 + index));
        await listPage.openPreview();
        await expect(listPage.overlay.locator(".refresher-frame-scroll")).toBeFocused();
        expect(await listPage.comments.count()).toBeLessThan(1000);
        await listPage.page.keyboard.press("End");
        // 키를 받는 그 자리에서 다 그린다. 늦게 그리면 End가 그때까지 그린 끝에 멈춘다.
        expect(await listPage.comments.count()).toBe(1000);
        await expect(listPage.comments.last()).toBeInViewport();
    });

    test("다 그리기 전에 누른 답글 버튼은 다 그린 뒤의 입력칸으로 데려간다", async ({listPage, site}) => {
        site.comments = Array.from({length: 1000}, (_, index) => fakeComment(100 + index));
        const frame = await listPage.openPreview();
        await listPage.comments.first().getByRole("button", {name: "ㅇㅇ 댓글에 답글", exact: true}).click();
        expect(await listPage.comments.count()).toBe(1000);
        const input = frame.getByRole("textbox", {name: "답글 입력", exact: true});
        await expect(input).toBeFocused();
        await expect(input).toBeInViewport();
    });

    test("댓글마다 되풀이되는 버튼은 클릭 리스너 하나만 단다", async ({listPage, browserName}) => {
        test.skip(browserName === "firefox", "요소의 리스너는 크로미움 CDP로만 센다.");
        await listPage.openPreview();
        const reply = listPage.comments.first().getByRole("button", {name: "고닉 댓글에 답글", exact: true});
        await expect(reply).toBeVisible();
        // 리스너는 콘텐츠 스크립트의 격리된 world에서 붙으므로 그 world에서 요소를 잡아야 보인다.
        const cdp = await listPage.page.context().newCDPSession(listPage.page);
        const contexts: number[] = [];
        cdp.on("Runtime.executionContextCreated", ({context}) => {
            if (context.auxData?.type === "isolated") contexts.push(context.id);
        });
        await cdp.send("Runtime.enable");
        const {result} = await cdp.send("Runtime.evaluate", {
            contextId: contexts[0],
            expression: "document.querySelector('refresher-root').shadowRoot.querySelector('.refresher-comment button[aria-label=\"고닉 댓글에 답글\"]')"
        });
        const {listeners} = await cdp.send("DOMDebugger.getEventListeners", {objectId: result.objectId!});
        expect(listeners.map(({type}) => type)).toEqual(["click"]);
    });

    test("본문이 확장 UI의 클래스를 써도 본문 상자 밖을 덮지 못한다", async ({listPage}) => {
        const frame = await listPage.openPreview();
        const contents = frame.locator(".refresher-preview-contents");
        await contents.evaluate((box) => box.insertAdjacentHTML("beforeend", "<div class=\"fixed inset-0 z-50 bg-background\" id=\"cover\"></div>"));
        const [outer, cover] = await Promise.all([contents.boundingBox(), frame.locator("#cover").boundingBox()]);
        expect(cover).toEqual(outer);
    });

    test("다크 모드에서 흐린 차단 본문도 본문 반전은 그대로 둔다", async ({listPage, storage}) => {
        await storage.setModuleSettings("block", {blur: true});
        await storage.set({"refresher:block:TEXT": [{id: "a", content: "본문 3", isRegex: false}]});
        await listPage.page.evaluate(() => document.head.append(Object.assign(document.createElement("style"), {id: "css-darkmode"})));
        const frame = await listPage.openPreview();
        const contents = frame.locator(".refresher-preview-contents");
        await expect(contents.locator("..")).toHaveAttribute("data-blocked", "blur");
        await expect(contents).toHaveCSS("filter", "invert(1)");
    });
});

test.describe("댓글 쓰기·지우기", () => {
    test("비회원 댓글은 폼에서 푼 service_code와 닉네임·비밀번호를 담아 보내고, 올라간 댓글을 다시 받는다", async ({listPage, site}) => {
        const frame = await listPage.openPreview();
        const input = frame.getByRole("textbox", {name: "댓글 입력", exact: true});
        await input.fill("미리보기에서 쓴 댓글");
        await frame.getByRole("button", {name: "작성", exact: true}).click();

        await expect(frame.getByText("미리보기에서 쓴 댓글", {exact: true})).toBeVisible();
        await expect(input).toHaveValue("");
        expect(site.submitted.map(({path}) => path)).toEqual(["/board/forms/comment_submit"]);
        const {body} = site.submitted[0]!;
        expect(Object.fromEntries(["id", "no", "c_gall_id", "c_gall_no", "name", "memo", "service_code"].map((key) => [key, body.get(key)]))).toEqual({
            id: "test", no: "3", c_gall_id: "test", c_gall_no: "3", name: "ㅇㅇ", memo: "미리보기에서 쓴 댓글", service_code: `abc${SERVICE_CODE_TAIL}`
        });
        // 비밀번호는 만들어 넣고, 답글이 아니면 부모 번호가 없다.
        expect(body.get("password")).toMatch(/^[a-z0-9]{8}$/);
        expect(body.has("c_no")).toBe(false);
        // 글 댓글은 디시 comment.js처럼 reCAPTCHA 키 쌍(rc_key)을 같이 보낸다.
        expect(body.get("rc_key")).toMatch(/^new3?$/);
    });

    test("쓰던 댓글은 글마다 남아 다른 글에 갔다 돌아와도 되살리고, 보내면 그 글의 초안만 지운다", async ({listPage}) => {
        const {page} = listPage;
        const frame = await listPage.openPreview();
        const input = frame.getByRole("textbox", {name: "댓글 입력", exact: true});
        await input.fill("글 3에 쓰던 댓글");
        await input.blur();
        await page.keyboard.press("PageDown");
        await expect(listPage.frameTitle).toHaveText("[말머리] 글 2 제목");
        await expect(input).toHaveValue("");
        await input.fill("글 2에 쓰던 댓글");
        await input.blur();

        await page.keyboard.press("PageUp");
        await expect(listPage.frameTitle).toHaveText("[말머리] 글 3 제목");
        await expect(input).toHaveValue("글 3에 쓰던 댓글");
        await frame.getByRole("button", {name: "작성", exact: true}).click();
        await expect(frame.getByText("글 3에 쓰던 댓글", {exact: true})).toBeVisible();
        await expect(input).toHaveValue("");

        // 보낸 글의 초안은 지우고, 다른 글의 초안은 그대로 둔다.
        await input.blur();
        await page.keyboard.press("PageDown");
        await expect(listPage.frameTitle).toHaveText("[말머리] 글 2 제목");
        await expect(input).toHaveValue("글 2에 쓰던 댓글");
        await page.keyboard.press("Escape");
        await expect(frame).toHaveCount(0);
        await listPage.openPreview();
        await expect(listPage.frameTitle).toHaveText("[말머리] 글 3 제목");
        await expect(input).toHaveValue("");
    });

    test("멤버만 댓글 갤러리는 댓글 0개 글에도 입력칸 대신 안내를 보인다", async ({listPage, site}) => {
        site.allowReply = 0;
        site.comments = [];
        const frame = await listPage.openPreview();
        await expect(frame.getByText("멤버만 댓글을 쓸 수 있습니다.")).toBeVisible();
        await expect(frame.getByRole("textbox", {name: "댓글 입력", exact: true})).toHaveCount(0);
    });

    test("글이 정한 댓글 대상(comment_id·comment_no)으로 보낸다", async ({listPage, site}) => {
        site.commentTarget = {id: "other", no: "77"};
        const frame = await listPage.openPreview();
        await frame.getByRole("textbox", {name: "댓글 입력", exact: true}).fill("대상 글에 쓴 댓글");
        await frame.getByRole("button", {name: "작성", exact: true}).click();
        await expect.poll(() => site.submitted.length).toBe(1);
        const {body} = site.submitted[0]!;
        expect(Object.fromEntries(["id", "no", "c_gall_id", "c_gall_no"].map((key) => [key, body.get(key)]))).toEqual({
            id: "other", no: "77", c_gall_id: "other", c_gall_no: "77"
        });
    });

    test("답글은 스레드 첫 댓글 번호와 답할 댓글 번호를 같이 보낸다", async ({listPage, site}) => {
        const frame = await listPage.openPreview();
        // 답글(11)에 답한다. 부모는 스레드 첫 댓글(10)이다.
        await listPage.comments.nth(1).getByRole("button", {name: "ㅇㅇ 댓글에 답글", exact: true}).click();
        // 입력칸으로 데려가고, 입력칸 위에 누구에게 답하는지 보인다.
        await expect(frame.getByRole("textbox", {name: "답글 입력", exact: true})).toBeFocused();
        await expect(frame.getByText("ㅇㅇ에게 답글", {exact: true})).toBeVisible();
        await frame.getByRole("textbox", {name: "답글 입력", exact: true}).fill("답글에 단 답글");
        await frame.getByRole("button", {name: "작성", exact: true}).click();

        await expect(frame.getByText("답글에 단 답글", {exact: true})).toBeVisible();
        const {body} = site.submitted[0]!;
        expect([body.get("c_no"), body.get("reply_no")]).toEqual(["10", "11"]);
        // 보내면 답글 대상이 풀린다.
        await expect(frame.getByRole("textbox", {name: "댓글 입력", exact: true})).toBeVisible();
    });

    test("입력칸 쪽의 답글 취소 버튼으로 답글 쓰기를 푼다", async ({listPage}) => {
        const frame = await listPage.openPreview();
        await listPage.comments.nth(0).getByRole("button", {name: "고닉 댓글에 답글", exact: true}).click();
        await expect(frame.getByText("고닉에게 답글", {exact: true})).toBeVisible();

        await frame.getByRole("button", {name: "답글 취소", exact: true}).click();
        await expect(frame.getByText("고닉에게 답글", {exact: true})).toHaveCount(0);
        await expect(frame.getByRole("textbox", {name: "댓글 입력", exact: true})).toBeFocused();
        await expect(listPage.comments.nth(0).getByRole("button", {name: "고닉 댓글에 답글", exact: true})).toHaveAttribute("aria-pressed", "false");
    });

    test("디시가 답글을 막은 댓글(reply_w N)에는 답글 버튼이 없다", async ({listPage, site}) => {
        site.comments = [fakeComment(10, {reply_w: "N"}), fakeComment(12)];
        await listPage.openPreview();
        await expect(listPage.comments.nth(1).getByRole("button", {name: "ㅇㅇ 댓글에 답글", exact: true})).toBeVisible();
        await expect(listPage.comments.nth(0).getByRole("button", {name: "ㅇㅇ 댓글에 답글", exact: true})).toHaveCount(0);
    });

    test("디시콘 창에서 고른 디시콘을 CSRF 토큰과 함께 디시콘 댓글로 보낸다", async ({listPage, site, context}) => {
        await context.addCookies([{name: "ci_c", value: "csrf-token", domain: ".dcinside.com", path: "/"}]);
        const frame = await listPage.openPreview();
        await frame.getByRole("button", {name: "디시콘", exact: true}).click();

        const popup = listPage.dialog;
        await expect(popup.getByRole("heading", {name: "디시콘", exact: true})).toBeVisible();
        await expect(popup.getByRole("group", {name: "디시콘 패키지", exact: true}).getByRole("button", {name: "테스트콘"})).toHaveAttribute("aria-pressed", "true");
        await popup.getByRole("button", {name: DCCON.title, exact: true}).click();
        await expect(popup).toHaveCount(0);

        const input = frame.getByRole("textbox", {name: "디시콘 입력", exact: true});
        await expect(input).toBeDisabled();
        await frame.getByRole("button", {name: "작성", exact: true}).click();

        await expect(frame.locator(`.refresher-comment img[src="${DCCON.list_img}"]`)).toBeVisible();
        expect(site.submitted.map(({path}) => path)).toEqual(["/dccon/insert_icon"]);
        const {body} = site.submitted[0]!;
        expect([body.get("package_idx"), body.get("detail_idx"), body.get("no")]).toEqual([DCCON.package_idx, DCCON.detail_idx, "3"]);
        // 디시 dccon.js처럼 ci_c 쿠키를 ci_t로 보낸다.
        expect(body.get("ci_t")).toBe("csrf-token");
        // 보내면 디시콘을 비워 다시 글을 쓸 수 있다.
        await expect(frame.getByRole("textbox", {name: "댓글 입력", exact: true})).toBeEnabled();
    });

    test("디시콘 패키지 줄은 Tab 정지점이 하나이고 화살표로 옮겨 Enter·Space로 고른다", async ({listPage}) => {
        const frame = await listPage.openPreview();
        await frame.getByRole("button", {name: "디시콘", exact: true}).click();

        const popup = listPage.dialog;
        const packages = popup.getByRole("group", {name: "디시콘 패키지", exact: true});
        const first = packages.getByRole("button", {name: "테스트콘", exact: true});
        const second = packages.getByRole("button", {name: "둘째콘", exact: true});
        await expect(first).toHaveAttribute("aria-pressed", "true");
        // 닫기 버튼 다음 Tab은 고른 패키지에 선다.
        await popup.getByRole("button", {name: "닫기", exact: true}).focus();
        await listPage.page.keyboard.press("Tab");
        await expect(first).toBeFocused();

        await listPage.page.keyboard.press("ArrowRight");
        await expect(second).toBeFocused();
        await listPage.page.keyboard.press("Enter");
        await expect(second).toHaveAttribute("aria-pressed", "true");
        await expect(first).toHaveAttribute("aria-pressed", "false");
        await expect(popup.getByRole("button", {name: "인사", exact: true})).toBeVisible();
        await expect(popup.getByRole("button", {name: DCCON.title, exact: true})).toHaveCount(0);

        await listPage.page.keyboard.press("ArrowLeft");
        await expect(first).toBeFocused();
        await listPage.page.keyboard.press("Space");
        await expect(first).toHaveAttribute("aria-pressed", "true");
        await expect(popup.getByRole("button", {name: DCCON.title, exact: true})).toBeVisible();

        // 남은 패키지를 건너뛰고 디시콘 칸으로 간다.
        await listPage.page.keyboard.press("Tab");
        await expect(popup.getByRole("button", {name: DCCON.title, exact: true})).toBeFocused();
    });

    test("글자콘 색은 묶음마다 Tab 정지점이 하나이고 화살표로 옮겨 Space로 고른다", async ({listPage}) => {
        const frame = await listPage.openPreview();
        await frame.getByRole("button", {name: "글자콘", exact: true}).click();

        const backgrounds = frame.getByRole("group", {name: "배경색", exact: true});
        const first = backgrounds.getByRole("button", {name: "배경색 #3b4890", exact: true});
        const second = backgrounds.getByRole("button", {name: "배경색 #b4b4e1", exact: true});
        await expect(first).toHaveAttribute("aria-pressed", "true");
        await first.focus();
        await listPage.page.keyboard.press("ArrowRight");
        await expect(second).toBeFocused();
        await listPage.page.keyboard.press("Space");
        await expect(second).toHaveAttribute("aria-pressed", "true");
        await expect(first).toHaveAttribute("aria-pressed", "false");

        // 남은 배경색을 건너뛰고 글자색 묶음의 고른 색으로 간다.
        await listPage.page.keyboard.press("Tab");
        await expect(frame.getByRole("group", {name: "글자색", exact: true}).getByRole("button", {name: "글자색 #ffffff", exact: true})).toBeFocused();
        // 되돌아가면 배경색 묶음에서 새로 고른 색에 선다.
        await listPage.page.keyboard.press("Shift+Tab");
        await expect(second).toBeFocused();
    });

    test("관리자는 댓글을 골라 한 번에 지운다", async ({listPage, site}) => {
        site.manager = true;
        await listPage.page.reload();
        await listPage.refreshButton.waitFor();
        await listPage.openPreview();
        await listPage.frame.getByRole("checkbox", {name: "전체 선택"}).click();
        await expect(listPage.frame.getByText("2개 선택")).toBeVisible();
        await listPage.frame.getByRole("button", {name: "삭제", exact: true}).click();
        await expect(listPage.alert).toContainText("선택한 댓글 2개를 삭제할까요?");
        await listPage.alert.getByRole("button", {name: "삭제", exact: true}).click();

        await expect(listPage.toast).toContainText("댓글을 삭제했습니다.");
        await expect(listPage.comments.nth(0)).toHaveAttribute("data-deleted");
        await expect(listPage.comments.nth(1)).toHaveAttribute("data-deleted");
        const {path, body} = site.submitted[0]!;
        expect(path).toBe("/ajax/minor_manager_board_ajax/delete_comment");
        expect([body.get("id"), body.get("pno"), body.getAll("cmt_nos[]")]).toEqual(["test", "3", ["10", "11"]]);
    });

    test("관리자의 전체 선택은 접힌 스레드의 답글을 고르지 않는다", async ({listPage, site}) => {
        site.manager = true;
        site.comments.push(fakeComment(12, {c_no: "10", depth: 1, ip: "3.4", memo: "답글 둘"}));
        await listPage.page.reload();
        await listPage.refreshButton.waitFor();
        const frame = await listPage.openPreview();
        await frame.getByRole("button", {name: "고닉 댓글의 답글 2개", exact: true}).click();
        await expect(frame.getByText("답글 둘", {exact: true})).toBeHidden();

        // 체크박스가 보이는 첫 댓글만 고르고 지운다.
        await frame.getByRole("checkbox", {name: "전체 선택"}).click();
        await expect(frame.getByText("1개 선택")).toBeVisible();
        await frame.getByRole("button", {name: "삭제", exact: true}).click();
        await expect(listPage.alert).toContainText("선택한 댓글 1개를 삭제할까요?");
        await listPage.alert.getByRole("button", {name: "삭제", exact: true}).click();

        await expect(listPage.toast).toContainText("댓글을 삭제했습니다.");
        expect(site.submitted.map(({path, body}) => [path, body.getAll("cmt_nos[]")])).toEqual([["/ajax/minor_manager_board_ajax/delete_comment", ["10"]]]);
    });

    // 배경을 흐리지 않아도 겹친 창의 배경은 그려야 단축키를 막는다.
    for (const popupBlur of [true, false]) test(`삭제 확인 창이 떠 있는 동안에는 PageDown으로 옆 글로 넘어가지 않는다 (흐림 ${popupBlur ? "켬" : "끔"})`, async ({listPage, site, storage}) => {
        site.manager = true;
        await storage.setModuleSettings("preview", {popupBlur});
        await listPage.page.reload();
        await listPage.refreshButton.waitFor();
        await listPage.openPreview();
        await listPage.frame.getByRole("checkbox", {name: "전체 선택"}).click();
        await listPage.frame.getByRole("button", {name: "삭제", exact: true}).click();
        await expect(listPage.alert).toBeVisible();

        // 포커스가 입력칸이 아니어도 확인 창이 떠 있으면 단축키를 막는다.
        await listPage.page.keyboard.press("PageDown");
        await listPage.page.keyboard.press("Escape");
        await expect(listPage.alert).toHaveCount(0);
        // 닫은 뒤 한 번 더 넘겨 2번 글에 서면 앞의 PageDown은 막힌 것이다 (넘어갔다면 1번 글).
        await listPage.page.keyboard.press("PageDown");
        await expect(listPage.frameTitle).toHaveText("[말머리] 글 2 제목");
        await expect(listPage.page).toHaveURL(viewUrl(2));
        expect(site.submitted).toEqual([]);
    });

    test("관리자가 댓글 하나를 지울 때는 확인 창을 거친다", async ({listPage, site}) => {
        site.manager = true;
        await listPage.page.reload();
        await listPage.refreshButton.waitFor();
        await listPage.openPreview();
        await listPage.comments.first().getByRole("button", {name: "고닉 댓글 삭제", exact: true}).click();
        await expect(listPage.alert).toContainText("댓글을 삭제할까요?");
        await listPage.alert.getByRole("button", {name: "삭제", exact: true}).click();

        await expect(listPage.toast).toContainText("댓글을 삭제했습니다.");
        expect(site.submitted.map(({path, body}) => [path, body.getAll("cmt_nos[]")])).toEqual([["/ajax/minor_manager_board_ajax/delete_comment", ["10"]]]);
    });

    test("유동 댓글은 비밀번호를 물어 지우고, 지운 뒤 목록을 다시 받는다", async ({listPage, site}) => {
        await listPage.openPreview();
        const remove = listPage.comments.nth(1).getByRole("button", {name: "ㅇㅇ 댓글 삭제", exact: true});
        await remove.click();
        const password = listPage.dialog.getByRole("textbox", {name: "댓글 비밀번호", exact: true});
        await expect(password).toHaveAttribute("type", "password");
        await password.fill("pw1234");
        await listPage.dialog.getByRole("button", {name: "삭제", exact: true}).click();

        await expect(listPage.toast).toContainText("댓글을 삭제했습니다.");
        await expect(listPage.comments.nth(1)).toHaveAttribute("data-deleted");
        const {path, body} = site.submitted[0]!;
        expect(path).toBe("/board/comment/comment_delete_submit");
        expect(Object.fromEntries(["id", "no", "re_no", "mode", "re_password"].map((key) => [key, body.get(key)]))).toEqual({
            id: "test", no: "3", re_no: "11", mode: "del", re_password: "pw1234"
        });
    });

    test("비밀번호 창을 연 사이 자동 새로고침으로 답글이 둘로 늘어도 창과 입력한 비밀번호가 남는다", async ({listPage, site, storage}) => {
        await storage.setModuleSettings("preview", {autoRefreshComment: true, commentRefreshInterval: 3000});
        await listPage.page.reload();
        await listPage.refreshButton.waitFor();
        await listPage.openPreview();
        await listPage.comments.nth(1).getByRole("button", {name: "ㅇㅇ 댓글 삭제", exact: true}).click();
        const password = listPage.dialog.getByRole("textbox", {name: "댓글 비밀번호", exact: true});
        await password.fill("pw1234");

        // 답글이 하나에서 둘로 늘면 Thread가 첫 답글을 Collapsible 안으로 옮겨 새로 마운트한다.
        site.comments.push(fakeComment(12, {c_no: "10", depth: 1, ip: "3.4", memo: "답글 둘"}));
        await expect(listPage.comments).toHaveCount(3, {timeout: 10_000});
        await expect(password).toHaveValue("pw1234");
        await listPage.dialog.getByRole("button", {name: "삭제", exact: true}).click();

        await expect(listPage.toast).toContainText("댓글을 삭제했습니다.");
        const {path, body} = site.submitted[0]!;
        expect([path, body.get("re_no"), body.get("re_password")]).toEqual(["/board/comment/comment_delete_submit", "11", "pw1234"]);
    });
});

test.describe("미니 미리보기", () => {
    test.beforeEach(async ({listPage, storage}) => {
        await storage.setModuleSettings("preview", {tooltipMode: true});
        // 설정은 저장소 감시로 탭에 닿는다. 닿을 때까지 다시 올린다.
        await expect(async () => {
            await listPage.leave();
            await listPage.titles.first().hover();
            await expect(listPage.mini).toHaveCount(1, {timeout: 1000});
        }).toPass();
    });

    test("제목에 마우스를 올리면 카드가 뜨고, 떠나면 닫힌다", async ({listPage}) => {
        await expect(listPage.mini.locator(".refresher-mini-contents")).toContainText("본문 3 내용입니다.");
        await listPage.leave();
        await expect(listPage.mini).toHaveCount(0);
    });

    test("훑고 지나간 제목은 글을 받지 않고, 멈춘 제목만 받는다", async ({listPage}) => {
        await listPage.leave();
        const viewed: string[] = [];
        listPage.page.on("request", (request) => {
            const url = new URL(request.url());
            if (url.pathname.startsWith("/board/view")) viewed.push(url.searchParams.get("no") ?? "");
        });

        for (const index of [0, 1, 2]) await listPage.titles.nth(index).hover();
        await expect(listPage.mini.locator(".refresher-mini-contents")).toContainText("본문 1 내용입니다.");
        expect(viewed).toEqual(["1"]);
    });
});
