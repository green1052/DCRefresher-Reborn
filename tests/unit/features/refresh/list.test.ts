import {beforeEach, describe, expect, it} from "vitest";

import {replaceList} from "@/features/refresh/list";

const row = (no: string, {title = `글 ${no}`, count = "1", notice = false}: { title?: string; count?: string; notice?: boolean } = {}): string =>
    `<tr class="ub-content" data-no="${no}"><td class="gall_num">${notice ? "<em class=\"icon_notice\"></em>" : no}</td><td class="gall_tit"><a href="/board/view/?id=test&no=${no}">${title}</a></td><td class="gall_count">${count}</td></tr>`;

const table = (rows: string[]): HTMLElement => {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = `<table class="gall_list"><thead><tr><th>번호</th></tr></thead><tbody>${rows.join("")}</tbody></table>`;
    return wrapper.querySelector("tbody")!;
};

const options = {navigated: false, search: undefined, searchType: null, fadeIn: true, keepDeleted: false};
const nos = (list: HTMLElement): string[] => Array.from(list.children, (child) => (child as HTMLElement).dataset.no ?? "");

/** 페이지에 목록을 두고 같은 목록으로 한 번 갈아끼운다. 처음 그려진 행은 비교할 틀(outerHTML)이 없어 첫 교체에서 모두 갈아끼워지기 때문이다 */
const mount = (rows: string[]): HTMLElement => {
    const list = table(rows);
    document.body.append(list.closest("table")!);
    replaceList(list, table(rows), options);
    return list;
};

beforeEach(() => {
    history.replaceState(null, "", "/board/lists/?id=test");
    document.body.innerHTML = "";
});

describe("replaceList", () => {
    it("공지 아래 새 글이 끼어들면 제자리에서 끼우고 밀려난 행을 뺀다. 그대로인 행은 같은 요소로 남는다", () => {
        const old = mount([row("n", {notice: true}), row("3"), row("2"), row("1")]);
        const kept = old.children[1]!;

        const added = replaceList(old, table([row("n", {notice: true}), row("5"), row("4"), row("3"), row("2")]), options);
        expect(added.map((element) => element.dataset.no)).toEqual(["5", "4"]);
        expect(nos(old)).toEqual(["n", "5", "4", "3", "2"]);
        expect(old.children[3]).toBe(kept);
        expect(old.isConnected).toBe(true);
        expect(added[0]?.classList.contains("refresherNewPost")).toBe(true);
    });

    it("수만 바뀐 행은 갈아끼우지 않고 글자만 고친다", () => {
        const old = mount([row("2"), row("1")]);
        const first = old.children[0]!;
        replaceList(old, table([row("2", {count: "9"}), row("1")]), options);
        expect(old.children[0]).toBe(first);
        expect(first.querySelector(".gall_count")?.textContent).toBe("9");
    });

    it("제목이 바뀐 행은 갈아끼운다", () => {
        const old = mount([row("2"), row("1")]);
        const first = old.children[0]!;
        replaceList(old, table([row("2", {title: "수정"}), row("1")]), options);
        expect(old.children[0]).not.toBe(first);
        expect(old.children[0]?.textContent).toContain("수정");
    });

    it("순서가 뒤섞이면 목록을 통째로 바꾸고, 페이지 이동은 새 글로 치지 않는다", () => {
        const old = table([row("3"), row("2"), row("1")]);
        document.body.append(old.closest("table")!);
        const fresh = table([row("2"), row("3"), row("1")]);
        replaceList(old, fresh, options);
        expect(old.isConnected).toBe(false);
        expect(fresh.isConnected).toBe(true);

        const navigated = replaceList(fresh, table([row("9"), row("8")]), {...options, navigated: true});
        expect(navigated.map((element) => element.dataset.no)).toEqual(["9", "8"]);
        expect(navigated[0]?.classList.contains("refresherNewPost")).toBe(false);
    });

    it("삭제된 글 보존: 새 목록에서 빠진 글을 제자리에 붉게 남기고 행 수를 맞춘다", () => {
        const old = table([row("4"), row("3"), row("2"), row("1")]);
        document.body.append(old.closest("table")!);
        replaceList(old, table([row("5"), row("4"), row("2"), row("1")]), {...options, keepDeleted: true});
        const list = document.querySelector("tbody")!;
        expect(nos(list)).toEqual(["5", "4", "3", "2"]);
        expect(list.children[2]?.classList.contains("refresherDeleted")).toBe(true);
    });

    it("관리자 목록은 받아온 행에 체크박스 칸을 채운다", () => {
        const wrapper = document.createElement("div");
        wrapper.innerHTML = "<table class=\"gall_list\"><thead><tr><th class=\"chkbox_th\"></th><th></th></tr></thead><tbody>" +
            "<tr class=\"ub-content\" data-no=\"1\"><td><input class=\"article_chkbox\" value=\"1\"></td><td class=\"gall_num\">1</td><td class=\"gall_tit\"><a href=\"/board/view/?id=test&no=1\">a</a></td></tr></tbody></table>";
        document.body.append(wrapper);
        const old = wrapper.querySelector("tbody")!;
        replaceList(old, table([row("2"), row("1")]), options);
        const inputs = Array.from(old.querySelectorAll<HTMLInputElement>("tr > td:first-child input.article_chkbox"), (input) => input.value);
        expect(inputs).toEqual(["2", "1"]);
    });
});
