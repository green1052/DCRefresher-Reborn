import {expect, test} from "./fixtures";

test.describe("관리", () => {
    // 설정은 저장소 감시로 탭에 닿는다. 닿기 전에 누르면 Ctrl+클릭이 새 탭으로 열리므로 페이지를 열기 전에 켠다.
    test.beforeEach(async ({storage}) => {
        await storage.setModules({manage: true});
        await storage.setModuleSettings("manage", {deleteViaCtrl: true, checkAllTargetUser: true});
    });

    test("관리하지 않는 갤러리에선 제목 Ctrl+클릭을 새 탭 열기로 두고, 관리자면 그 글을 지우고 행을 뺀다", async ({listPage, site}) => {
        const {page} = listPage;
        const title = listPage.row(3).getByRole("link", {name: "세 번째 글"});
        // Ctrl+클릭으로 연 새 탭은 가짜 디시를 거치지 않고 실제 디시로 나가므로 문서에서 막는다. 관리 모듈이 그냥 둔 클릭만 표시를 남긴다.
        const guard = () => document.addEventListener("click", (ev) => {
            if (!ev.defaultPrevented) document.documentElement.setAttribute("data-e2e-passed", "");
            ev.preventDefault();
        });
        await page.evaluate(guard);
        await title.click({modifiers: ["Control"]});
        await expect(page.locator("html")).toHaveAttribute("data-e2e-passed");
        expect(site.submitted).toEqual([]);

        site.manager = true;
        await page.reload();
        await listPage.refreshButton.waitFor();
        await page.evaluate(guard);
        await title.click({modifiers: ["Control"]});

        await expect(listPage.row(3)).toHaveCount(0);
        expect(site.submitted.map(({path}) => path)).toEqual(["/ajax/minor_manager_board_ajax/delete_list"]);
        const {body} = site.submitted[0]!;
        expect([body.get("id"), body.getAll("nos[]")]).toEqual(["test", ["3"]]);
    });

    test("유동 글의 체크박스를 Shift+클릭하면 IP가 같은 글만 같이 체크한다", async ({listPage, site}) => {
        // 2번 글(ㅇㅇ, 1.2)과 IP가 같은 글 하나, 닉네임만 같은 글 하나를 더한다.
        site.manager = true;
        site.rows = [
            {no: 5, title: "다섯 번째 글", nick: "ㅇㅇ", uid: "", ip: "1.2"},
            {no: 4, title: "네 번째 글", nick: "ㅇㅇ", uid: "", ip: "3.4"},
            ...site.rows
        ];
        await listPage.page.reload();
        await listPage.refreshButton.waitFor();

        await listPage.row(2).getByRole("checkbox").click({modifiers: ["Shift"]});
        // 회원 글(3, 1)은 data-ip가 비어 있다. 유동 글을 [data-ip=""]로 찾으면 회원 글이 모두 체크된다.
        const checked = listPage.rows.filter({has: listPage.page.getByRole("checkbox", {checked: true})});
        await expect(checked.locator(".gall_num")).toHaveText(["5", "2"]);
    });
});
