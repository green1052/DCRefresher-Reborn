import {expect, test} from "./fixtures";
import {openOptions} from "./pages/extension";

/** 옵션 페이지(evaluate)의 chrome 전역. 테스트 파일은 확장 번들이 아니라 타입이 없다. */
declare const chrome: typeof browser;

/** 클라우드 수동 백업 메타 (core/backup.ts의 BackupMeta 중 테스트가 보는 것). */
type ManualMeta = { backup?: { createdAt: number; device?: string } };

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

    test("설정 검색은 맞는 설정만 남기고, 꺼진 모듈의 설정도 펼쳐 켜야 적용된다고 알린다", async ({page, extensionId}) => {
        const options = await openOptions(page, extensionId, "general");
        const search = page.getByRole("searchbox", {name: "설정 검색", exact: true});
        const card = options.card("검색 이어 보기");
        const slider = card.getByRole("slider", {name: "최대 다음 검색 횟수", exact: true});
        await expect(slider).toHaveCount(0);

        await search.fill("최대 다음 검색");
        await expect(options.cards).toHaveCount(1);
        await expect(card.getByRole("switch", {name: "검색 이어 보기 사용", exact: true})).not.toBeChecked();
        await expect(slider).toBeVisible();
        await expect(card.getByText("모듈을 켜야 적용됩니다.")).toBeVisible();

        await search.fill("없는 설정");
        await expect(options.cards).toHaveCount(0);
        await expect(page.getByText("\"없는 설정\" 검색 결과 없음")).toBeVisible();

        await search.fill("");
        expect(await options.cards.count()).toBeGreaterThanOrEqual(10);
        await expect(slider).toHaveCount(0);
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

        // 키보드로 되돌리면 사라진 버튼 대신 그 설정의 컨트롤로 포커스가 간다.
        await reset.focus();
        await page.keyboard.press("Enter");
        await expect(fadeIn).toBeChecked();
        await expect(reset).toHaveCount(0);
        await expect(fadeIn).toBeFocused();
        await expect.poll(() => storage.get("refresher:module:refresh:settings")).toEqual({fadeIn: true});
    });

    test("순서 버튼으로 항목을 끝까지 옮겨도 포커스가 그 항목에 남는다", async ({page, extensionId, storage}) => {
        await openOptions(page, extensionId, "general");
        const order = page.getByRole("group", {name: "정보 배치 순서", exact: true});
        await order.getByRole("button", {name: "메모 위로", exact: true}).focus();
        await page.keyboard.press("Enter");
        await expect.poll(() => storage.get("refresher:module:userinfo:settings")).toEqual({badgeOrder: ["MEMO", "UID", "RATIO", "PERMBAN"]});
        // 맨 위로 와 '위로'가 막혔으니 같은 항목의 '아래로'로 옮긴다.
        await expect(order.getByRole("button", {name: "메모 아래로", exact: true})).toBeFocused();
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
        // 모드마다 무엇을 가리는지 적는다. 불일치·불포함은 나머지를 모두 가린다고 알린다.
        const defaultMode = page.getByRole("combobox", {name: "기본 차단 모드", exact: true});
        await expect(defaultMode).toHaveAccessibleDescription("모드가 '기본값'인 항목에 씁니다. 값과 똑같으면 가립니다.");

        await page.getByRole("button", {name: "추가", exact: true}).click();
        const {dialog} = options;
        // 차단 모드의 '기본값'은 고른 값으로 보인다 (빈 값이 자리표시자로 흐려지지 않는다).
        const mode = dialog.getByRole("combobox", {name: "차단 모드", exact: true});
        await expect(mode).not.toHaveAttribute("data-placeholder");
        await expect(mode).toHaveAccessibleDescription("기본 차단 모드(일치): 값과 똑같으면 가립니다.");
        const input = dialog.getByPlaceholder("닉네임 값을 입력해 주세요");
        await expect(input).toBeFocused();
        await input.fill("차단닉");
        // 다른 모드를 골랐다가 '기본값'으로 되돌리면 모드 없이 저장된다.
        await mode.click();
        await page.getByRole("option", {name: "포함", exact: true}).click();
        await expect(mode.getByText("포함", {exact: true})).toBeVisible();
        await expect(mode).toHaveAccessibleDescription("값이 들어 있으면 가립니다.");
        await mode.click();
        await page.getByRole("option", {name: "불일치", exact: true}).click();
        await expect(mode).toHaveAccessibleDescription(/나머지를 모두 가립니다/);
        await mode.click();
        await page.getByRole("option", {name: "기본값", exact: true}).click();
        await dialog.getByRole("button", {name: "추가", exact: true}).click();

        await expect(options.table.getByText("차단닉", {exact: true})).toBeVisible();
        await expect.poll(() => storage.get("refresher:block:NICK")).toEqual([{id: expect.any(String), content: "차단닉", isRegex: false}]);
    });

    test("줄의 휴지통은 항목 이름을 달고, 확인해야 그 항목만 지운다", async ({page, extensionId, storage}) => {
        await storage.set({"refresher:block:NICK": [{id: "a", content: "남길닉", isRegex: false}, {id: "b", content: "지울닉", isRegex: false}]});
        const {table, alert, dialog} = await openOptions(page, extensionId, "block");
        const remove = table.getByRole("button", {name: "지울닉 삭제", exact: true});

        // 취소하면 지우지 않고 포커스가 휴지통으로 돌아온다. 편집 창도 열리지 않는다.
        await remove.click();
        await expect(alert).toContainText("\"지울닉\" 삭제할까요?");
        await alert.getByRole("button", {name: "취소", exact: true}).click();
        await expect(remove).toBeFocused();
        await expect(dialog).toHaveCount(0);
        expect(await storage.get("refresher:block:NICK")).toHaveLength(2);

        await remove.click();
        await alert.getByRole("button", {name: "삭제", exact: true}).click();
        await expect.poll(() => storage.get("refresher:block:NICK")).toEqual([{id: "a", content: "남길닉", isRegex: false}]);
        await expect(table.getByText("지울닉", {exact: true})).toHaveCount(0);
        // 삭제 알림 토스트도 role=dialog라 편집 창은 제목으로 확인한다.
        await expect(dialog.getByRole("heading", {name: "닉네임 차단 수정"})).toHaveCount(0);
        await expect(page.getByRole("tabpanel")).toBeFocused();
    });

    test("삭제 알림의 되돌리기는 지운 항목을 id 그대로 원래 자리에 되살리고 사용 기록도 지킨다", async ({page, extensionId, storage}) => {
        const list = [{id: "a", content: "가닉", isRegex: false}, {id: "b", content: "나닉", isRegex: false}, {id: "c", content: "다닉", isRegex: false}];
        const old = Date.now() - 200 * 24 * 60 * 60 * 1000;
        const usage = {block: {a: old, b: old, c: old}, memo: {}};
        await storage.set({"refresher:block:NICK": list, "refresher:usage": usage});
        const {table, alert, toasts} = await openOptions(page, extensionId, "block");

        await table.getByRole("button", {name: "나닉 삭제", exact: true}).click();
        await alert.getByRole("button", {name: "삭제", exact: true}).click();
        await expect(toasts).toContainText("닉네임 차단 목록을 1개 삭제했습니다.");
        await expect.poll(() => storage.get("refresher:block:NICK")).toEqual([list[0], list[2]]);

        await toasts.getByRole("button", {name: "되돌리기", exact: true}).click();
        await expect.poll(() => storage.get("refresher:block:NICK")).toEqual(list);
        await expect(table.getByText("나닉", {exact: true})).toBeVisible();
        // 되살린 항목의 마지막 사용이 '오늘'로 바뀌지 않는다.
        await expect(table.getByText("200일 전")).toHaveCount(3);
        expect(await storage.get("refresher:usage")).toEqual(usage);
    });

    test("지운 뒤 같은 차단을 다시 넣었으면 되돌리기가 그것을 겹쳐 넣지 않는다", async ({page, extensionId, storage}) => {
        const list = [{id: "a", content: "가닉", isRegex: false}, {id: "b", content: "나닉", isRegex: false}];
        await storage.set({"refresher:block:NICK": list});
        const {table, alert, toasts} = await openOptions(page, extensionId, "block");

        await page.getByRole("button", {name: "전체 삭제", exact: true}).click();
        await alert.getByRole("button", {name: "삭제", exact: true}).click();
        await expect.poll(() => storage.get("refresher:block:NICK")).toEqual([]);
        // 다른 곳에서 같은 닉을 새 id로 다시 차단했다.
        const readded = {id: "z", content: "가닉", isRegex: false};
        await storage.set({"refresher:block:NICK": [readded]});
        await expect(table.getByText("가닉", {exact: true})).toBeVisible();

        await toasts.getByRole("button", {name: "되돌리기", exact: true}).click();
        await expect.poll(() => storage.get("refresher:block:NICK")).toEqual([readded, list[1]]);
    });

    test("전체 삭제는 확인한 뒤 그 종류의 항목을 모두 지운다", async ({page, extensionId, storage}) => {
        await storage.set({"refresher:block:NICK": [{id: "a", content: "가닉", isRegex: false}, {id: "b", content: "나닉", isRegex: false}]});
        const {alert} = await openOptions(page, extensionId, "block");
        await page.getByRole("button", {name: "전체 삭제", exact: true}).click();
        await expect(alert).toContainText("모두(2개) 삭제할까요?");
        await alert.getByRole("button", {name: "삭제", exact: true}).click();
        await expect.poll(() => storage.get("refresher:block:NICK")).toEqual([]);
    });

    test("갤러리·마지막 사용으로 걸러 보이는 항목만 지우고, 페이지를 다시 열 때 지운 항목의 사용 기록을 정리한다", async ({page, extensionId, storage}) => {
        const day = 24 * 60 * 60 * 1000;
        await storage.set({
            "refresher:block:NICK": [
                {id: "a", content: "오래된닉", isRegex: false, gallery: "g1"},
                {id: "b", content: "공통닉", isRegex: false},
                {id: "c", content: "최근닉", isRegex: false, gallery: "g1"}
            ],
            "refresher:usage": {block: {a: Date.now() - 100 * day, b: Date.now() - 100 * day, c: Date.now()}, memo: {}}
        });
        const {table, alert} = await openOptions(page, extensionId, "block");
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
        await alert.getByRole("button", {name: "삭제", exact: true}).click();
        await expect.poll(() => storage.get("refresher:block:NICK")).toMatchObject([{id: "b"}, {id: "c"}]);
        // 보이는 항목이 없어 삭제 버튼이 막히므로 포커스는 그 버튼이 아니라 탭 패널로 돌아간다.
        await expect(page.getByRole("tabpanel")).toBeFocused();
        // 지운 항목의 사용 기록은 되돌리기로 쓸 수 있게 남겼다가 페이지를 다시 열 때 정리한다.
        expect(await storage.get("refresher:usage")).toMatchObject({block: {a: expect.any(Number)}});
        await page.reload();
        await expect(table.getByText("공통닉")).toBeVisible();
        await expect.poll(() => storage.get("refresher:usage")).toEqual({block: {b: expect.any(Number), c: expect.any(Number)}, memo: {}});
    });

    test("긴 목록은 200줄씩 그리고 더 보기로 펼치며, 검색은 그리지 않은 줄까지 찾는다", async ({page, extensionId, storage}) => {
        await storage.set({"refresher:block:NICK": Array.from({length: 450}, (_, i) => ({id: `n${i}`, content: `닉${i}번`, isRegex: false}))});
        const {table} = await openOptions(page, extensionId, "block");
        const rows = table.locator("tbody tr");
        const more = page.getByRole("button", {name: /^더 보기/});
        await expect(rows).toHaveCount(200);
        await expect(table.getByText("닉0번", {exact: true})).toHaveCount(0);

        // 가장 오래된 항목은 처음 200줄 밖이지만 검색하면 나온다.
        const search = page.getByRole("searchbox", {name: "차단 목록 검색", exact: true});
        await search.fill("닉0번");
        await expect(rows).toHaveCount(1);
        await expect(more).toHaveCount(0);
        await search.fill("");

        await more.click();
        await expect(rows).toHaveCount(400);
        await expect(more).toHaveText("더 보기 (+50)");
        // 마지막 묶음을 펼치면 버튼이 사라지므로 포커스는 탭 패널로 간다.
        await more.click();
        await expect(rows).toHaveCount(450);
        await expect(more).toHaveCount(0);
        await expect(page.getByRole("tabpanel")).toBeFocused();

        // 검색어가 바뀌면 다시 200줄부터 그린다.
        await search.fill("닉");
        await expect(rows).toHaveCount(200);
        await expect(more).toHaveText("더 보기 (+200)");
    });

    test("가져오기 창은 가져온 뒤 닫혀 포커스가 가져오기 버튼으로 돌아오고, 성공은 막지 않는 토스트로 알린다", async ({page, extensionId, storage}) => {
        const {dialog, alert, toasts} = await openOptions(page, extensionId, "block");
        const importButton = page.getByRole("button", {name: "가져오기", exact: true});
        await importButton.click();

        const json = dialog.getByRole("textbox", {name: "JSON 데이터"});
        await expect(json).toBeFocused();
        await json.fill(JSON.stringify({NICK: [{content: "가져온닉", isRegex: false}]}));
        await dialog.getByRole("button", {name: "가져오기", exact: true}).click();

        await expect(toasts).toContainText("차단 목록을 가져왔습니다.");
        await expect.poll(() => storage.get("refresher:block:NICK")).toMatchObject([{content: "가져온닉"}]);
        // 토스트도 role=dialog라 다이얼로그는 입력칸으로 확인한다.
        await expect(json).toHaveCount(0);
        await expect(alert).toHaveCount(0);
        await expect(importButton).toBeFocused();

        // 실패는 확인해야 하는 알림 창으로 남는다.
        await importButton.click();
        await json.fill("{");
        await dialog.getByRole("button", {name: "가져오기", exact: true}).click();
        await expect(alert).toContainText("차단 목록을 가져오지 못했습니다.");
    });

    test("파일로 내보낸 목록을 가져오기 창에서 파일로 불러와 되살린다", async ({page, extensionId, storage}) => {
        await storage.set({"refresher:block:NICK": [{id: "a", content: "파일닉", isRegex: false}]});
        const {dialog, toasts} = await openOptions(page, extensionId, "block");

        const downloading = page.waitForEvent("download");
        await page.getByRole("button", {name: "파일로 내보내기", exact: true}).click();
        const download = await downloading;
        expect(download.suggestedFilename()).toMatch(/^dcrefresher-block-\d{8}\.json$/);
        await expect(toasts).toContainText("차단 목록을 파일로 내보냈습니다.");

        await storage.set({"refresher:block:NICK": []});
        await page.getByRole("button", {name: "가져오기", exact: true}).click();
        const choosing = page.waitForEvent("filechooser");
        await dialog.getByRole("button", {name: "파일에서 불러오기", exact: true}).click();
        await (await choosing).setFiles(await download.path());

        await expect(toasts).toContainText("차단 목록을 가져왔습니다.");
        await expect.poll(() => storage.get("refresher:block:NICK")).toMatchObject([{content: "파일닉"}]);
        await expect(dialog.getByRole("textbox", {name: "JSON 데이터"})).toHaveCount(0);
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

    test("메모 전체 삭제도 알림의 되돌리기로 되살린다", async ({page, extensionId, storage}) => {
        const memos = {user1: {text: "하나", color: "#ff0000"}, user2: {text: "둘", color: "#00ff00"}};
        await storage.set({"refresher:memo:UID": memos});
        const {alert, toasts} = await openOptions(page, extensionId, "memo");

        await page.getByRole("button", {name: "전체 삭제", exact: true}).click();
        await alert.getByRole("button", {name: "삭제", exact: true}).click();
        await expect(toasts).toContainText("메모를 2개 삭제했습니다.");
        await expect.poll(() => storage.get("refresher:memo:UID")).toEqual({});

        await toasts.getByRole("button", {name: "되돌리기", exact: true}).click();
        await expect.poll(() => storage.get("refresher:memo:UID")).toEqual(memos);
    });
});

test.describe("옵션 - 데이터 탭 백업·초기화", () => {
    test("수동 백업을 덮어쓰기로 복원하면 백업할 때의 목록으로 돌아간다", async ({page, extensionId, storage}) => {
        await storage.set({"refresher:block:NICK": [{id: "a", content: "백업닉", isRegex: false}]});
        const {dialog, toasts} = await openOptions(page, extensionId, "data");
        await page.getByRole("button", {name: "백업", exact: true}).click();
        await expect(toasts).toContainText("데이터를 클라우드에 백업했습니다.");

        await storage.set({"refresher:block:NICK": [{id: "b", content: "나중닉", isRegex: false}]});
        await page.getByRole("button", {name: "복원", exact: true}).click();
        await dialog.getByRole("button", {name: "덮어쓰기", exact: true}).click();
        await dialog.getByRole("button", {name: /^수동 백업/}).click();
        await expect(toasts).toContainText("백업을 복원했습니다.");
        await expect.poll(() => storage.get("refresher:block:NICK")).toEqual([{id: expect.any(String), content: "백업닉", isRegex: false}]);
    });

    test("다른 기기가 올린 수동 백업은 덮기 전에 묻고, 이 기기가 다시 올린 뒤에는 묻지 않는다", async ({page, extensionId}) => {
        const {alert, toasts} = await openOptions(page, extensionId, "data");
        const backup = page.getByRole("button", {name: "백업", exact: true});
        const status = page.getByText(/^수동 백업:/);
        const createdAt = () => page.evaluate(async () => (await chrome.storage.sync.get<ManualMeta>("backup")).backup?.createdAt);
        await backup.click();
        await expect(toasts).toContainText("데이터를 클라우드에 백업했습니다.");

        // 다른 기기가 같은 칸에 올린 것처럼 메타의 기기와 시각을 바꾼다.
        await page.evaluate(async () => {
            const {backup: meta} = await chrome.storage.sync.get<ManualMeta>("backup");
            await chrome.storage.sync.set({backup: {...meta, device: "다른 기기", createdAt: Date.UTC(2020, 5, 15)}});
        });
        await expect(status).toContainText("2020.");
        await backup.click();
        await expect(alert).toContainText("다른 기기에서 올린 수동 백업을 이 기기의 설정으로 덮어씁니다.");
        await alert.getByRole("button", {name: "백업", exact: true}).click();
        await expect(status).not.toContainText("2020.");

        const before = await createdAt();
        await backup.click();
        await expect.poll(createdAt).not.toBe(before);
        await expect(alert).toBeHidden();
    });

    test("자동 백업이 켜진 채 초기화하면 자동 백업을 먼저 끄고 데이터를 지우며, 알림의 되돌리기는 다시 켜고 탭의 되돌리기는 다시 끈다", async ({page, extensionId, storage}) => {
        await storage.set({"refresher:backup:auto": true, "refresher:block:NICK": [{id: "a", content: "지울닉", isRegex: false}]});
        const {alert, toasts, card} = await openOptions(page, extensionId, "data");
        await page.getByRole("button", {name: "데이터 초기화", exact: true}).click();
        await alert.getByRole("button", {name: "초기화", exact: true}).click();
        await expect(toasts).toContainText("자동 백업을 껐습니다.");
        // 켜 둔 채 지우면 빈 설정이 클라우드의 자동 백업을 덮어쓴다.
        expect(await storage.get("refresher:backup:auto")).toBe(false);
        expect(await storage.get("refresher:block:NICK")).toBeUndefined();

        // 알림의 되돌리기는 초기화가 끈 자동 백업도 다시 켠다.
        await toasts.getByRole("button", {name: "되돌리기", exact: true}).click();
        await expect(toasts).toContainText("자동 백업도 다시 켰습니다.");
        expect(await storage.get("refresher:backup:auto")).toBe(true);
        expect(await storage.get("refresher:block:NICK")).toEqual([{id: "a", content: "지울닉", isRegex: false}]);

        // 탭의 되돌리기로 빈 상태에 돌아가면 빈 설정이 클라우드를 덮지 않게 다시 끈다.
        await card("되돌리기").getByRole("button", {name: "되돌리기", exact: true}).click();
        await expect(toasts).toContainText("되돌렸습니다. 클라우드 백업을 지키려고 자동 백업을 껐습니다.");
        expect(await storage.get("refresher:backup:auto")).toBe(false);
        expect(await storage.get("refresher:block:NICK")).toBeUndefined();
    });

    test("초기화한 뒤 알림의 되돌리기를 누르면 초기화 직전 목록으로 돌아가고, 탭의 되돌리기로 다시 앞으로 간다", async ({page, extensionId, storage}) => {
        await storage.set({"refresher:block:NICK": [{id: "a", content: "남길닉", isRegex: false}]});
        const {alert, toasts, card} = await openOptions(page, extensionId, "data");
        await page.getByRole("button", {name: "데이터 초기화", exact: true}).click();
        await alert.getByRole("button", {name: "초기화", exact: true}).click();
        await expect(toasts).toContainText("데이터를 초기화했습니다.");
        await expect.poll(() => storage.get("refresher:block:NICK")).toBeUndefined();

        await toasts.getByRole("button", {name: "되돌리기", exact: true}).click();
        await expect(toasts).toContainText("직전 상태로 되돌렸습니다.");
        await expect.poll(() => storage.get("refresher:block:NICK")).toEqual([{id: "a", content: "남길닉", isRegex: false}]);

        await card("되돌리기").getByRole("button", {name: "되돌리기", exact: true}).click();
        await expect.poll(() => storage.get("refresher:block:NICK")).toBeUndefined();
    });

    test("그 뒤에 다른 작업을 했으면 예전 알림의 되돌리기는 아무것도 바꾸지 않는다", async ({page, extensionId, storage}) => {
        await storage.set({"refresher:block:NICK": [{id: "a", content: "남길닉", isRegex: false}]});
        const {alert, toasts, card} = await openOptions(page, extensionId, "data");
        await page.getByRole("button", {name: "데이터 초기화", exact: true}).click();
        await alert.getByRole("button", {name: "초기화", exact: true}).click();
        await expect(toasts).toContainText("데이터를 초기화했습니다.");

        await card("되돌리기").getByRole("button", {name: "되돌리기", exact: true}).click();
        await expect.poll(() => storage.get("refresher:block:NICK")).toEqual([{id: "a", content: "남길닉", isRegex: false}]);

        await toasts.getByRole("button", {name: "되돌리기", exact: true}).click();
        await expect(toasts).toContainText("이 알림으로는 되돌릴 수 없습니다.");
        expect(await storage.get("refresher:block:NICK")).toEqual([{id: "a", content: "남길닉", isRegex: false}]);
    });
});
