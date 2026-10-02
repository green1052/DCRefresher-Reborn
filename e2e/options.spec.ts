import {expect, storedIn, test} from "./fixtures";
import {openOptions} from "./pages/options";

test.describe("옵션 페이지", () => {
    test("모듈 카드를 그리고 스위치로 켜고 끈 값이 저장소에 남는다", async ({page, extensionId}) => {
        const options = await openOptions(page, extensionId, "general");

        await expect(options.card("글 목록 새로고침")).toBeVisible();
        expect(await options.cards().count()).toBeGreaterThanOrEqual(10);

        // Radix 스타일이 들어갔는지 (CSS를 줄여도 쓰는 컴포넌트는 남아야 한다).
        const cursor = await page.locator(".rt-SwitchRoot").first().evaluate((element) => getComputedStyle(element).cursor);
        expect(cursor).toBe("pointer");

        const stealth = options.card("스텔스 모드").getByRole("switch");
        await expect(stealth).not.toBeChecked();
        await stealth.click();
        await expect(stealth).toBeChecked();
        await expect.poll(() => storedIn(page, "refresher:modules")).toEqual({stealth: true});
    });

    test("설정을 바꾸면 모듈 설정 키에 저장되고 되돌리기가 보인다", async ({page, extensionId}) => {
        const options = await openOptions(page, extensionId, "general");

        const card = options.card("글 목록 새로고침");
        const fade = card.getByRole("switch", {name: "새 게시글 효과"});
        await fade.click();
        await expect(fade).not.toBeChecked();
        await expect(card.getByRole("button", {name: "새 게시글 효과 기본값으로 되돌리기"})).toBeVisible();
        await expect.poll(() => storedIn(page, "refresher:module:refresh:settings")).toEqual({fadeIn: false});
    });

    test("차단 탭에서 항목을 추가하고 데이터 탭이 그려진다", async ({page, extensionId}) => {
        const options = await openOptions(page, extensionId, "block");
        await expect(page.getByText("기본 차단 모드")).toBeVisible();

        await page.getByRole("button", {name: "추가"}).first().click();
        await page.getByPlaceholder("닉네임 값을 입력해 주세요").fill("차단닉");
        await page.getByRole("button", {name: "추가", exact: true}).last().click();
        await expect(page.locator("table").getByText("차단닉")).toBeVisible();
        expect(await storedIn(page, "refresher:block:NICK")).toMatchObject([{content: "차단닉", isRegex: false}]);

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
        await page.getByRole("button", {name: "삭제", exact: true}).click();
        await expect.poll(async () => ((await storedIn(page, "refresher:block:NICK")) as { id: string }[]).map(({id}) => id)).toEqual(["b", "c"]);
        // 지운 항목의 사용 기록도 정리된다.
        await expect.poll(async () => Object.keys(((await storedIn(page, "refresher:usage")) as { block: object }).block).sort()).toEqual(["b", "c"]);
    });
});
