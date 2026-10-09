import {afterEach, describe, expect, it} from "vitest";

import {isWholeFirstPage, replaceList, syncPaging} from "@/features/refresh/list";

interface RowOptions {
    title?: string;
    count?: number;
    replies?: number;
    notice?: boolean;
}

/** 디시 목록 행. 공지는 번호 칸에 공지 아이콘이 있다. */
const row = (no: string, {title = `글 ${no}`, count = 1, replies = 0, notice = false}: RowOptions = {}): string =>
    `<tr class="ub-content us-post" data-no="${no}"><td class="gall_num">${notice ? "<em class=\"icon_notice\"></em>" : no}</td>` +
    `<td class="gall_tit"><a href="/board/view/?id=test&no=${no}">${title}</a><a class="reply_numbox"><span class="reply_num">[${replies}]</span></a></td>` +
    `<td class="gall_count">${count}</td><td class="gall_recommend">0</td></tr>`;

/** 번호 없는 설문·AD 행. */
const adRow = (label: string): string => `<tr class="ub-content"><td class="gall_num">${label}</td><td class="gall_tit">광고</td></tr>`;

const tbody = (rows: string[], head = "<th>번호</th>"): HTMLElement => {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = `<table class="gall_list"><thead><tr>${head}</tr></thead><tbody>${rows.join("")}</tbody></table>`;
    return wrapper.querySelector("tbody")!;
};

const OPTIONS = {navigated: false, search: undefined, searchType: null, fadeIn: true, keepDeleted: false};

const nos = (list: Element): string[] => Array.from(list.children, (child) => child.getAttribute("data-no") ?? child.querySelector(".gall_num")?.textContent ?? "");

const current = (): HTMLElement => document.querySelector("tbody")!;

/** 페이지에 목록을 두고 같은 목록으로 한 번 갈아끼운다. 처음 그린 행은 비교할 원래 HTML이 없어 첫 교체에서 모두 바뀌기 때문이다. */
const mount = (rows: string[]): HTMLElement => {
    const list = tbody(rows);
    document.body.append(list.closest("table")!);
    replaceList(list, tbody(rows), OPTIONS);
    return current();
};

afterEach(() => {
    document.body.innerHTML = "";
});

describe("replaceList", () => {
    it("공지 아래 새 글이 끼어들면 제자리에 끼우고 밀려난 행을 뺀다", () => {
        const list = mount([row("n", {notice: true}), row("3"), row("2"), row("1")]);
        const [notice, three, two] = Array.from(list.children);

        const {added, changed} = replaceList(list, tbody([row("n", {notice: true}), row("5"), row("4"), row("3"), row("2")]), OPTIONS);

        expect(current()).toBe(list);
        expect(nos(list)).toEqual(["n", "5", "4", "3", "2"]);
        expect(added.map((element) => element.dataset.no)).toEqual(["5", "4"]);
        expect(changed).toBe(true);
        // 그대로인 행은 같은 요소로 남는다 (hover·리스너 유지).
        expect(list.children[0]).toBe(notice);
        expect(list.children[3]).toBe(three);
        expect(list.children[4]).toBe(two);
    });

    it("새 글에 효과를 넣고 지연에 상한을 둔다", () => {
        const list = mount([row("1")]);
        const fresh = Array.from({length: 12}, (_, index) => row(String(100 - index)));
        const {added} = replaceList(list, tbody([...fresh, row("1")]), OPTIONS);
        expect(added).toHaveLength(12);
        expect(added.every((element) => element.classList.contains("refresherNewPost"))).toBe(true);
        expect(added[0]?.style.animationDelay).toBe("500ms");
        expect(added[11]?.style.animationDelay).toBe("50ms");
    });

    it("fadeIn을 끄면 효과를 넣지 않는다", () => {
        const list = mount([row("1")]);
        const {added: [added]} = replaceList(list, tbody([row("2"), row("1")]), {...OPTIONS, fadeIn: false});
        expect(added?.classList.contains("refresherNewPost")).toBe(false);
    });

    it("수만 바뀐 행은 갈아끼우지 않고 글자만 고친다", () => {
        const list = mount([row("2"), row("1")]);
        const first = list.children[0]!;
        const {changed} = replaceList(list, tbody([row("2", {count: 9, replies: 3}), row("1")]), OPTIONS);
        expect(changed).toBe(false);
        expect(list.children[0]).toBe(first);
        expect(first.querySelector(".gall_count")?.textContent).toBe("9");
        expect(first.querySelector(".reply_num")?.textContent).toBe("[3]");
    });

    it("제목이 바뀐 행은 갈아끼운다", () => {
        const list = mount([row("2"), row("1")]);
        const first = list.children[0]!;
        const second = list.children[1]!;
        const {changed} = replaceList(list, tbody([row("2", {title: "고친 제목"}), row("1")]), OPTIONS);
        expect(changed).toBe(true);
        expect(list.children[0]).not.toBe(first);
        expect(list.children[0]?.textContent).toContain("고친 제목");
        expect(list.children[1]).toBe(second);
    });

    it("페이지가 처음 그린 행은 첫 교체에서 갈아끼운다", () => {
        const list = tbody([row("1")]);
        document.body.append(list.closest("table")!);
        const original = list.children[0];
        replaceList(list, tbody([row("1")]), OPTIONS);
        expect(list.children[0]).not.toBe(original);
    });

    it("위 글이 지워져 아래에서 올라온 행은 새 글이 아니다", () => {
        const list = mount([row("5"), row("4"), row("3")]);
        const {added} = replaceList(list, tbody([row("6"), row("5"), row("3"), row("2")]), OPTIONS);
        expect(added.map((element) => element.dataset.no)).toEqual(["6"]);
        expect(nos(current())).toEqual(["6", "5", "3", "2"]);
    });

    it("겹치는 글이 없으면 모두 새 글이다", () => {
        const list = mount([row("2"), row("1")]);
        const {added} = replaceList(list, tbody([row("9"), row("8")]), OPTIONS);
        expect(added.map((element) => element.dataset.no)).toEqual(["9", "8"]);
    });

    it("번호 없는 행도 자리로 짝지어 제자리에서 고친다", () => {
        const list = mount([adRow("AD"), row("2"), adRow("AD"), row("1")]);
        const ad = list.children[0];
        replaceList(list, tbody([adRow("AD"), row("3"), row("2"), adRow("AD")]), OPTIONS);
        expect(current()).toBe(list);
        expect(list.children[0]).toBe(ad);
        expect(nos(list)).toEqual(["AD", "3", "2", "AD"]);
    });

    it("순서가 뒤섞이면 목록을 통째로 바꾼다", () => {
        const list = mount([row("3"), row("2"), row("1")]);
        const fresh = tbody([row("2"), row("3"), row("1")]);
        replaceList(list, fresh, OPTIONS);
        expect(list.isConnected).toBe(false);
        expect(current()).toBe(fresh);
    });

    it("페이지를 넘긴 로드는 통째로 바꾸고 효과를 넣지 않는다", () => {
        const list = mount([row("2"), row("1")]);
        const fresh = tbody([row("3"), row("2"), row("1")]);
        const {added} = replaceList(list, fresh, {...OPTIONS, navigated: true});
        expect(current()).toBe(fresh);
        expect(added[0]?.classList.contains("refresherNewPost")).toBe(false);
    });

    it("검색 결과는 통째로 바꾸고 검색어를 칠한다", () => {
        const list = mount([row("1", {title: "사과 맛"})]);
        const fresh = tbody([row("1", {title: "사과 맛"})]);
        replaceList(list, fresh, {...OPTIONS, search: "사과"});
        expect(current()).toBe(fresh);
        expect(fresh.querySelector(".gall_tit .mark")?.textContent).toBe("사과");
    });

    it("관리자 목록이면 받아온 행에 체크박스 칸을 채운다", () => {
        const head = "<th class=\"chkbox_th\"></th><th>번호</th>";
        const list = tbody([row("1").replace("<td class=\"gall_num\">", "<td><input type=\"checkbox\" class=\"article_chkbox\" value=\"1\"></td><td class=\"gall_num\">")], head);
        document.body.append(list.closest("table")!);
        const fresh = tbody([row("2"), row("1")]);
        replaceList(list, fresh, OPTIONS);
        const boxes = Array.from(current().querySelectorAll<HTMLInputElement>(".article_chkbox"), (box) => box.value);
        expect(boxes).toEqual(["2", "1"]);
    });

    describe("삭제된 글 보존", () => {
        const KEEP = {...OPTIONS, keepDeleted: true};

        it("빠진 글을 제자리에 붉게 남기고 행 수를 맞춘다", () => {
            const list = mount([row("4"), row("3"), row("2"), row("1")]);
            const deleted = list.children[1];
            replaceList(list, tbody([row("5"), row("4"), row("2"), row("1")]), KEEP);
            expect(nos(current())).toEqual(["5", "4", "3", "2"]);
            expect(current().children[2]).toBe(deleted);
            expect(deleted?.classList.contains("refresherDeleted")).toBe(true);
        });

        it("한 번 남긴 행은 다음 새로고침에도 남는다", () => {
            mount([row("3"), row("2"), row("1")]);
            replaceList(current(), tbody([row("3"), row("1"), row("0")]), KEEP);
            expect(nos(current())).toEqual(["3", "2", "1"]);
            replaceList(current(), tbody([row("3"), row("1"), row("0")]), KEEP);
            expect(nos(current())).toEqual(["3", "2", "1"]);
            expect(current().querySelector("[data-no='2']")?.classList.contains("refresherDeleted")).toBe(true);
        });

        it("새 글에 밀려 다음 페이지로 간 글은 남기지 않는다", () => {
            mount([row("3"), row("2"), row("1")]);
            replaceList(current(), tbody([row("5"), row("4"), row("3")]), KEEP);
            expect(nos(current())).toEqual(["5", "4", "3"]);
            expect(current().querySelector(".refresherDeleted")).toBeNull();
        });

        it("새 글이 한 페이지 넘게 몰려 와도 옛 글을 남기지 않는다", () => {
            mount([row("3"), row("2"), row("1")]);
            replaceList(current(), tbody([row("6"), row("5"), row("4")]), KEEP);
            expect(nos(current())).toEqual(["6", "5", "4"]);
        });

        it("맨 아래 글이 지워지면 올라온 행 앞에 끼운다", () => {
            mount([row("3"), row("2"), row("1")]);
            replaceList(current(), tbody([row("3"), row("2"), row("0")]), KEEP);
            expect(nos(current())).toEqual(["3", "2", "1"]);
            expect(current().children[2]?.classList.contains("refresherDeleted")).toBe(true);
        });

        it("공지에서 내린 글과 번호 없는 행은 남기지 않는다", () => {
            mount([row("9", {notice: true}), adRow("설문"), row("2"), row("1")]);
            replaceList(current(), tbody([row("2"), row("1")]), KEEP);
            expect(nos(current())).toEqual(["2", "1"]);
        });

        it("페이지를 넘긴 로드에서는 남기지 않는다", () => {
            mount([row("2"), row("1")]);
            replaceList(current(), tbody([row("1")]), {...KEEP, navigated: true});
            expect(nos(current())).toEqual(["1"]);
        });

        it("검색 결과에서는 남기지 않는다", () => {
            mount([row("2"), row("1")]);
            replaceList(current(), tbody([row("1")]), {...KEEP, search: "글"});
            expect(nos(current())).toEqual(["1"]);
        });

        it("순서가 같으면 제자리에서 고치고, 새 글이 끼어들면 통째로 바꾼다", () => {
            const list = mount([row("2"), row("1")]);
            replaceList(list, tbody([row("2", {count: 5}), row("1")]), KEEP);
            expect(current()).toBe(list);

            const fresh = tbody([row("3"), row("2"), row("1")]);
            replaceList(list, fresh, KEEP);
            expect(current()).toBe(fresh);
        });
    });
});

describe("isWholeFirstPage", () => {
    it("거르지 않은 목록의 1페이지만 참이다", () => {
        expect(isWholeFirstPage("https://gall.dcinside.com/board/lists/?id=test")).toBe(true);
        expect(isWholeFirstPage("https://gall.dcinside.com/board/lists/?id=test&page=1")).toBe(true);
        expect(isWholeFirstPage("https://gall.dcinside.com/board/lists/?id=test&page=2")).toBe(false);
        expect(isWholeFirstPage("https://gall.dcinside.com/board/lists/?id=test&exception_mode=recommend")).toBe(false);
        expect(isWholeFirstPage("https://gall.dcinside.com/board/lists/?id=test&search_head=10")).toBe(false);
    });
});

describe("syncPaging", () => {
    const PAGING = (current: number): string =>
        `<div class="left_content"><article><div class="gall_listwrap"></div><div class="bottom_paging_box"><a href="?page=1">1</a><em>${current}</em></div></article></div>`;

    it("다르면 받아온 페이징으로 바꾸고 같으면 건드리지 않는다", () => {
        document.body.innerHTML = PAGING(2);
        const box = document.querySelector(".bottom_paging_box")!;
        const link = box.querySelector("a");

        syncPaging(new DOMParser().parseFromString(PAGING(2), "text/html"));
        expect(box.querySelector("a")).toBe(link);

        syncPaging(new DOMParser().parseFromString(PAGING(3), "text/html"));
        expect(box.querySelector("em")?.textContent).toBe("3");
    });
});
