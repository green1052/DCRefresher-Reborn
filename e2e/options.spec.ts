import {expect, test} from "./fixtures";
import {openOptions} from "./pages/extension";

test.describe("옵션 - 설정 탭", () => {
    test("모듈 카드를 그리고, 스위치로 켜고 끈 값을 저장해 다시 열어도 남는다", async ({page, extensionId, storage}) => {
        const options = await openOptions(page, extensionId, "general");
        await expect(options.card("글 목록 새로고침")).toBeVisible();
        expect(await options.cards.count()).toBeGreaterThanOrEqual(10);
        // 범위 설정마다 손잡이가 하나다.
        await expect(page.getByRole("slider", {name: "새로고침 주기", exact: true})).toHaveCount(1);

        const stealth = page.getByRole("switch", {name: "스텔스 모드 사용", exact: true});
        await expect(stealth).not.toBeChecked();
        await stealth.click();
        await expect(stealth).toBeChecked();
        await expect.poll(() => storage.get("refresher:modules")).toEqual({stealth: true});

        await page.reload();
        await expect(stealth).toBeChecked();
    });

    test("설정을 바꾸면 모듈 설정에 저장하고, 기본값으로 되돌리기 버튼이 되돌린다", async ({page, extensionId, storage}) => {
        const options = await openOptions(page, extensionId, "general");
        const card = options.card("글 목록 새로고침");
        const fadeIn = card.getByRole("switch", {name: "새 게시글 효과", exact: true});
        const reset = card.getByRole("button", {name: "새 게시글 효과 기본값으로 되돌리기", exact: true});
        await expect(fadeIn).toBeChecked();
        await expect(reset).toHaveCount(0);

        await fadeIn.click();
        await expect(fadeIn).not.toBeChecked();
        await expect.poll(() => storage.get("refresher:module:refresh:settings")).toEqual({fadeIn: false});

        await reset.click();
        await expect(fadeIn).toBeChecked();
        await expect(reset).toHaveCount(0);
        await expect.poll(() => storage.get("refresher:module:refresh:settings")).toEqual({fadeIn: true});
    });

    test("폰트 교체 설정이 옵션 페이지 본문 글꼴에 걸린다 (크롬이 확장 페이지 body에 넣는 글꼴에 지지 않는다)", async ({page, extensionId, storage}) => {
        await storage.setModuleSettings("fonts", {customFonts: "Gulim"});
        const options = await openOptions(page, extensionId, "general");

        const bodyFont = () => page.evaluate(() => getComputedStyle(document.body).fontFamily);
        await expect.poll(bodyFont).toBe("Gulim, sans-serif");

        const name = options.card("폰트 교체").getByRole("textbox", {name: "폰트 이름", exact: true});
        await name.fill("Batang");
        await name.press("Enter");
        await expect.poll(bodyFont).toBe("Batang, sans-serif");
        await expect.poll(() => storage.get("refresher:module:fonts:settings")).toEqual({customFonts: "Batang"});
    });
});

test.describe("옵션 - 차단 탭", () => {
    test("항목을 추가하면 표에 보이고 저장소에 남는다", async ({page, extensionId, storage}) => {
        const options = await openOptions(page, extensionId, "block");
        await expect(page.getByText("기본 차단 모드")).toBeVisible();

        await page.getByRole("button", {name: "추가", exact: true}).click();
        const {dialog} = options;
        // 차단 모드의 '기본값'은 고른 값으로 보인다 (빈 값이 자리표시자로 흐려지지 않는다).
        await expect(dialog.getByRole("combobox", {name: "차단 모드", exact: true})).not.toHaveAttribute("data-placeholder");
        const input = dialog.getByPlaceholder("닉네임 값을 입력해 주세요");
        await expect(input).toBeFocused();
        await input.fill("차단닉");
        await dialog.getByRole("button", {name: "추가", exact: true}).click();

        await expect(options.table.getByText("차단닉", {exact: true})).toBeVisible();
        await expect.poll(() => storage.get("refresher:block:NICK")).toMatchObject([{content: "차단닉", isRegex: false}]);
    });

    test("갤러리·마지막 사용으로 걸러 보이는 항목만 지우고, 지운 항목의 사용 기록도 정리한다", async ({page, extensionId, storage}) => {
        const day = 24 * 60 * 60 * 1000;
        await storage.set({
            "refresher:block:NICK": [
                {id: "a", content: "오래된닉", isRegex: false, gallery: "g1"},
                {id: "b", content: "공통닉", isRegex: false},
                {id: "c", content: "최근닉", isRegex: false, gallery: "g1"}
            ],
            "refresher:usage": {block: {a: Date.now() - 100 * day, b: Date.now() - 100 * day, c: Date.now()}, memo: {}}
        });
        const {table, dialog} = await openOptions(page, extensionId, "block");
        await expect(table.getByText("공통닉")).toBeVisible();
        await expect(table.getByText("100일 전").first()).toBeVisible();

        await page.getByRole("combobox", {name: "갤러리", exact: true}).click();
        await page.getByRole("option", {name: "g1"}).click();
        await expect(table.getByText("공통닉")).toHaveCount(0);
        await expect(table.getByText("최근닉")).toBeVisible();

        await page.getByRole("combobox", {name: "마지막 사용", exact: true}).click();
        await page.getByRole("option", {name: "90일 넘게 안 쓰임"}).click();
        await expect(table.getByText("최근닉")).toHaveCount(0);
        await expect(table.getByText("오래된닉")).toBeVisible();

        await page.getByRole("button", {name: "보이는 1개 삭제"}).click();
        await dialog.getByRole("button", {name: "삭제", exact: true}).click();
        await expect.poll(() => storage.get("refresher:block:NICK")).toMatchObject([{id: "b"}, {id: "c"}]);
        // 보이는 항목이 없어 삭제 버튼이 막히므로 포커스는 그 버튼이 아니라 탭 패널로 돌아간다.
        await expect(page.getByRole("tabpanel")).toBeFocused();
        // 지운 항목의 사용 기록도 정리한다.
        await expect.poll(() => storage.get("refresher:usage")).toEqual({block: {b: expect.any(Number), c: expect.any(Number)}, memo: {}});
    });

    test("가져오기 창은 가져온 뒤 닫히고, 알림을 닫으면 포커스가 가져오기 버튼으로 돌아온다", async ({page, extensionId, storage}) => {
        const {dialog} = await openOptions(page, extensionId, "block");
        const importButton = page.getByRole("button", {name: "가져오기", exact: true});
        await importButton.click();

        const json = dialog.getByRole("textbox", {name: "JSON 데이터"});
        await expect(json).toBeFocused();
        await json.fill(JSON.stringify({NICK: [{content: "가져온닉", isRegex: false}]}));
        await dialog.getByRole("button", {name: "가져오기", exact: true}).click();

        await expect(page.getByRole("dialog", {name: "차단 목록을 가져왔습니다."})).toBeVisible();
        await expect.poll(() => storage.get("refresher:block:NICK")).toMatchObject([{content: "가져온닉"}]);
        await page.getByRole("button", {name: "확인", exact: true}).click();
        await expect(dialog).toHaveCount(0);
        await expect(importButton).toBeFocused();
    });
});

test.describe("옵션 - 메모·데이터 탭", () => {
    test("메모 탭에서 메모를 추가하면 표에 보이고 저장소에 남는다", async ({page, extensionId, storage}) => {
        const {dialog, table} = await openOptions(page, extensionId, "memo");
        await page.getByRole("button", {name: "추가", exact: true}).click();

        await expect(dialog.getByRole("heading", {name: "메모 추가"})).toBeVisible();
        const target = dialog.getByPlaceholder("아이디, 닉네임 또는 IP");
        await expect(target).toBeFocused();
        await target.fill("user9");
        await dialog.getByPlaceholder("메모를 입력해 주세요 (160자 제한)").fill("옵션 메모");
        await dialog.getByRole("button", {name: "추가", exact: true}).click();

        await expect(dialog).toHaveCount(0);
        await expect(table.getByText("옵션 메모")).toBeVisible();
        await expect.poll(() => storage.get("refresher:memo:UID")).toMatchObject({user9: {text: "옵션 메모"}});
    });
});
