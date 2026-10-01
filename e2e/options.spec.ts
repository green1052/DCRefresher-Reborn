import {expect, storedIn, test} from "./fixtures";
import {openOptions} from "./pages/options";

test.describe("옵션 페이지", () => {
    test("모듈 카드를 그리고 스위치로 켜고 끈 값이 저장소에 남는다", async ({page, extensionId, errors: _errors}) => {
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

    test("설정을 바꾸면 모듈 설정 키에 저장되고 되돌리기가 보인다", async ({page, extensionId, errors: _errors}) => {
        const options = await openOptions(page, extensionId, "general");

        const card = options.card("글 목록 새로고침");
        const fade = card.getByRole("switch", {name: "새 게시글 효과"});
        await fade.click();
        await expect(fade).not.toBeChecked();
        await expect(card.getByRole("button", {name: "새 게시글 효과 기본값으로 되돌리기"})).toBeVisible();
        await expect.poll(() => storedIn(page, "refresher:module:refresh:settings")).toEqual({fadeIn: false});
    });

    test("차단 탭에서 항목을 추가하고 데이터 탭이 그려진다", async ({page, extensionId, errors: _errors}) => {
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
});
