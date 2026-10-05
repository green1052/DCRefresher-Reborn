import {expect, test} from "./fixtures";
import {openOptions} from "./pages/options";

test.describe("옵션 페이지", () => {
    test("모듈 카드를 그리고 스위치로 켜고 끈 값이 저장소에 남는다", async ({page, extensionId, storage}) => {
        const options = await openOptions(page, extensionId, "general");

        await expect(options.card("글 목록 새로고침")).toBeVisible();
        // 범위 설정마다 손잡이가 하나다 (같은 이름의 손잡이가 겹쳐 둘 그려지지 않는다).
        await expect(page.getByRole("slider", {name: "새로고침 주기", exact: true})).toHaveCount(1);
        expect(await options.cards().count()).toBeGreaterThanOrEqual(10);

        const stealth = options.card("스텔스 모드").getByRole("switch");
        await expect(stealth).not.toBeChecked();
        await stealth.click();
        await expect(stealth).toBeChecked();
        await expect.poll(() => storage.get("refresher:modules")).toEqual({stealth: true});
    });

    test("설정을 바꾸면 모듈 설정 키에 저장되고 되돌리기가 보인다", async ({page, extensionId, storage}) => {
        const options = await openOptions(page, extensionId, "general");

        const card = options.card("글 목록 새로고침");
        const fade = card.getByRole("switch", {name: "새 게시글 효과"});
        await fade.click();
        await expect(fade).not.toBeChecked();
        await expect(card.getByRole("button", {name: "새 게시글 효과 기본값으로 되돌리기"})).toBeVisible();
        await expect.poll(() => storage.get("refresher:module:refresh:settings")).toEqual({fadeIn: false});
    });

    test("폰트 교체 설정이 옵션 페이지 글자에도 걸린다", async ({page, extensionId, storage}) => {
        await storage.setModuleSettings("fonts", {customFonts: "Gulim"});
        const options = await openOptions(page, extensionId, "general");

        // 크롬이 확장 페이지 body에 넣는 자체 폰트 규칙에 지지 않는다.
        const font = () => options.cards().first().evaluate((card) => getComputedStyle(card).fontFamily);
        await expect.poll(font).toBe("Gulim, sans-serif");
        const name = options.card("폰트 교체").getByRole("textbox").first();
        await name.fill("Batang");
        await name.press("Enter");
        await expect.poll(font).toBe("Batang, sans-serif");
    });

    test("차단 탭에서 항목을 추가하고 데이터 탭이 그려진다", async ({page, extensionId, storage}) => {
        const options = await openOptions(page, extensionId, "block");
        await expect(page.getByText("기본 차단 모드")).toBeVisible();

        await page.getByRole("button", {name: "추가"}).first().click();
        // 차단 모드의 '기본값'은 고른 값으로 보인다 (빈 문자열 값이 자리표시자로 흐려지지 않는다).
        await expect(page.getByRole("dialog").getByRole("combobox", {name: "차단 모드", exact: true})).not.toHaveAttribute("data-placeholder");
        await expect(page.getByPlaceholder("닉네임 값을 입력해 주세요")).toBeFocused();
        await page.getByPlaceholder("닉네임 값을 입력해 주세요").fill("차단닉");
        await page.getByRole("button", {name: "추가", exact: true}).last().click();
        await expect(page.locator("table").getByText("차단닉")).toBeVisible();
        await expect.poll(() => storage.get("refresher:block:NICK")).toMatchObject([{content: "차단닉", isRegex: false}]);

        await options.goto("data");
        await expect(page.getByText("클라우드 백업")).toBeVisible();
    });
    test("차단 목록을 갤러리와 오래 안 쓰인 것으로 거르고, 보이는 것만 지운다", async ({page, extensionId, storage}) => {
        const day = 24 * 60 * 60 * 1000;
        await storage.set({
            "refresher:block:NICK": [
                {id: "a", content: "오래된닉", isRegex: false, gallery: "g1"},
                {id: "b", content: "공통닉", isRegex: false},
                {id: "c", content: "최근닉", isRegex: false, gallery: "g1"}
            ],
            "refresher:usage": {block: {a: Date.now() - 100 * day, b: Date.now() - 100 * day, c: Date.now()}, memo: {}}
        });
        await openOptions(page, extensionId, "block");
        const table = page.locator("table");
        await expect(table.getByText("공통닉")).toBeVisible();
        await expect(table.getByText("100일 전").first()).toBeVisible();

        await page.getByRole("combobox", {name: "갤러리"}).click();
        await page.getByRole("option", {name: "g1"}).click();
        await expect(table.getByText("공통닉")).toHaveCount(0);
        await expect(table.getByText("최근닉")).toBeVisible();

        await page.getByRole("combobox", {name: "마지막 사용"}).click();
        await page.getByRole("option", {name: "90일 넘게 안 쓰임"}).click();
        await expect(table.getByText("최근닉")).toHaveCount(0);
        await expect(table.getByText("오래된닉")).toBeVisible();

        await page.getByRole("button", {name: "보이는 1개 삭제"}).click();
        await page.getByRole("dialog").getByRole("button", {name: "삭제", exact: true}).click();
        await expect.poll(async () => ((await storage.get("refresher:block:NICK")) as { id: string }[]).map(({id}) => id)).toEqual(["b", "c"]);
        // 지운 항목의 사용 기록도 정리된다.
        await expect.poll(async () => Object.keys(((await storage.get("refresher:usage")) as { block: object }).block).sort()).toEqual(["b", "c"]);
    });
    test("가져오기 창은 가져온 뒤 닫히고, 알림을 닫으면 포커스가 가져오기 버튼으로 돌아온다", async ({page, extensionId, storage}) => {
        await openOptions(page, extensionId, "block");
        const importButton = page.getByRole("button", {name: "가져오기", exact: true});
        await importButton.click();
        // 창이 열리면 입력칸에 바로 쓸 수 있다 (Preact는 autoFocus로 포커스를 옮기지 않아 창이 직접 옮긴다).
        await expect(page.getByRole("textbox", {name: "JSON 데이터"})).toBeFocused();
        await page.getByRole("textbox", {name: "JSON 데이터"}).fill(JSON.stringify({NICK: [{content: "가져온닉", isRegex: false}]}));
        await page.getByRole("dialog").getByRole("button", {name: "가져오기"}).click();

        await expect(page.getByRole("dialog", {name: "차단 목록을 가져왔습니다."})).toBeVisible();
        await expect.poll(() => storage.get("refresher:block:NICK")).toMatchObject([{content: "가져온닉"}]);
        await page.getByRole("button", {name: "확인"}).click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(importButton).toBeFocused();
    });
});
