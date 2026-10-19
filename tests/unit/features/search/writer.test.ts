import {afterEach, beforeEach, expect, it, vi} from "vitest";

import type {WriterFilter} from "@/core/http/urls";
import {addWriterTypes, removeWriterTypes} from "@/features/search/writer";

let controller: AbortController;
const search = vi.fn<(filter: WriterFilter) => void>();
// 디시의 검색 버튼 처리기. 버블 단계에서 받는다.
const dcSearch = vi.fn();

const item = (name: string): HTMLElement => Array.from(document.querySelectorAll<HTMLElement>("#searchTypeLayer > li")).find((li) => li.textContent === name)!;
const input = (): HTMLInputElement => document.querySelector<HTMLInputElement>("input[name='search_keyword']")!;
const button = (): HTMLButtonElement => document.querySelector<HTMLButtonElement>(".bnt_search")!;
const label = (): string | null => document.querySelector("#search_type_txt")!.textContent;

beforeEach(() => {
    document.body.innerHTML = "<ul id=\"searchTypeLayer\"><li>글쓴이</li></ul><span id=\"search_type_txt\">제목+내용</span>" +
        "<div class=\"bottom_search\"><input name=\"search_keyword\"><button class=\"bnt_search\"></button></div>";
    button().addEventListener("click", dcSearch);
    controller = new AbortController();
});

afterEach(() => controller.abort());

it("아이디·IP를 고르면 디시 검색 대신 search를 부르고, 디시 종류를 고르면 디시 검색으로 돌아간다", () => {
    addWriterTypes(null, search, controller.signal);
    item("IP").click();
    expect(label()).toBe("IP");

    input().value = " 1.2 ";
    input().dispatchEvent(new KeyboardEvent("keydown", {key: "Enter", bubbles: true, cancelable: true}));
    button().click();
    expect(search.mock.calls).toEqual([[{kind: "ip", value: "1.2"}], [{kind: "ip", value: "1.2"}]]);
    expect(dcSearch).not.toHaveBeenCalled();

    // 한글 조합을 끝내는 Enter로는 검색하지 않는다.
    input().dispatchEvent(new KeyboardEvent("keydown", {key: "Enter", isComposing: true, bubbles: true, cancelable: true}));
    expect(search).toHaveBeenCalledTimes(2);

    item("글쓴이").click();
    button().click();
    expect(dcSearch).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledTimes(2);
});

it("작성자 거르기 중인 페이지면 그 종류와 값을 채워 두고, 빼면 더한 종류가 사라진다", () => {
    addWriterTypes({kind: "uid", value: "abc"}, search, controller.signal);
    expect(label()).toBe("아이디");
    expect(input().value).toBe("abc");
    button().click();
    expect(search).toHaveBeenCalledWith({kind: "uid", value: "abc"});

    removeWriterTypes();
    expect(Array.from(document.querySelectorAll("#searchTypeLayer > li"), (li) => li.textContent)).toEqual(["글쓴이"]);
});
