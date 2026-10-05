// 글 보기 페이지에서만 하는 판정 (본문 차단·댓글 차단어·같은 댓글 접기).
// @vitest-environment-options {"url": "https://gall.dcinside.com/board/view/?id=test&no=10"}
import {afterEach, beforeEach, describe, expect, it} from "vitest";

import {ROWS_HIDDEN_EVENT} from "@/core/block";
import type {BlockEntry} from "@/core/storage/types";
import block from "@/features/block/index";

import {setBlockLists, tick} from "../../../helpers";
import {type Running, runModule} from "../module";

const entry = (content: string): BlockEntry => ({id: content, content, isRegex: false});

const comment = (id: string, nick: string, text: string): string =>
    `<li class="ub-content" id="${id}"><div class="cmt_info"><div class="cmt_nickbox"><span class="gall_writer ub-writer" data-nick="${nick}" data-uid="" data-ip=""></span></div>` +
    `<div class="cmt_txtbox"><p class="usertxt">${text}</p></div></div></li>`;

const VIEW = (comments: string[]): string =>
    "<div class=\"gallview_head ub-content\"><h3><span class=\"title_headtext\">[공지]</span><span class=\"title_subject\">제목</span></h3>" +
    "<div class=\"gall_writer ub-writer\" data-nick=\"글쓴이\" data-uid=\"\" data-ip=\"\"></div></div>" +
    "<div class=\"writing_view_box\"><div class=\"write_div\">본문에 나쁜 말</div></div>" +
    `<ul class="cmt_list">${comments.join("")}</ul>`;

let running: Running<unknown> | undefined;
const start = async (patch = {}) => (running = await runModule(block, patch));

const writeDiv = (): HTMLElement => document.querySelector(".write_div")!;
const notices = (): number => document.querySelectorAll(".refresherTextNotice").length;

beforeEach(() => {
    document.body.innerHTML = VIEW([]);
    setBlockLists();
});

afterEach(() => {
    running?.stop();
    running = undefined;
});

describe("본문 차단", () => {
    it("차단어가 든 본문을 숨기고 안내를 넣는다", async () => {
        setBlockLists({TEXT: [entry("나쁜 말")]});
        await start();
        expect(writeDiv().classList.contains("refresherBlocked")).toBe(true);
        expect(writeDiv().previousElementSibling?.textContent).toBe("게시글 내용이 차단되었습니다.");
    });

    it("blur면 안내 없이 흐리게 한다", async () => {
        setBlockLists({TEXT: [entry("나쁜 말")]});
        await start({blur: true});
        expect(writeDiv().classList.contains("refresherBlur")).toBe(true);
        expect(notices()).toBe(0);
    });

    it("글 보기 머리가 막혔으면 본문도 가린다", async () => {
        setBlockLists({NICK: [entry("글쓴이")]});
        await start();
        expect(document.querySelector(".gallview_head")?.classList.contains("refresherBlocked")).toBe(true);
        expect(writeDiv().classList.contains("refresherBlocked")).toBe(true);
    });

    it("머리의 [말머리]는 대괄호를 벗겨 본다", async () => {
        setBlockLists({TAB: [entry("공지")]});
        await start();
        expect(document.querySelector(".gallview_head")?.classList.contains("refresherBlocked")).toBe(true);
    });

    it("다시 판정해도 안내가 쌓이지 않고, 풀면 안내를 뗀다", async () => {
        // 앞 인스턴스(재주입)가 남긴 안내.
        writeDiv().before(Object.assign(document.createElement("div"), {className: "refresherTextNotice"}));
        setBlockLists({TEXT: [entry("나쁜 말")]});
        await start();
        expect(notices()).toBe(1);
        setBlockLists({TEXT: [entry("나쁜")]});
        expect(notices()).toBe(1);
        setBlockLists();
        expect(notices()).toBe(0);
        expect(writeDiv().classList.contains("refresherBlocked")).toBe(false);
    });
});

describe("댓글 차단어", () => {
    it("댓글 글자와 글자콘 글자를 앞뒤 공백을 떼고 본다", async () => {
        document.body.innerHTML = VIEW([
            comment("c1", "a", "  욕설  "),
            "<li class=\"ub-content\" id=\"c2\"><div class=\"cmt_info\"><span class=\"ub-writer\" data-nick=\"b\" data-uid=\"\" data-ip=\"\"></span>" +
            "<div class=\"comment_dccon\"><div class=\"coment_dccon_txt\"><span class=\"txtcon_txt\">욕설</span></div></div></div></li>",
            comment("c3", "c", "착한 말")
        ]);
        setBlockLists({COMMENT: [{...entry("욕설"), mode: "SAME"}]});
        await start();
        const blocked = Array.from(document.querySelectorAll(".cmt_list .refresherBlocked"), (element) => element.id);
        expect(blocked).toEqual(["c1", "c2"]);
    });
});

describe("같은 댓글 접기", () => {
    const FOLD = {foldDuplicate: true, duplicateCount: 3, duplicateMinLength: 2};
    const ids = (selector: string): string[] => Array.from(document.querySelectorAll(selector), (element) => element.closest("li")?.id ?? "");

    it("반복된 댓글은 첫 댓글에 배지를 달고 나머지를 접는다", async () => {
        document.body.innerHTML = VIEW([comment("c1", "a", "도배 글"), comment("c2", "b", "도배  글"), comment("c3", "c", "도배 글"), comment("c4", "d", "다른 글")]);
        await start(FOLD);
        await tick();
        expect(document.querySelector("#c1 .refresherDuplicateBadge")?.textContent).toBe("같은 댓글 ×3");
        expect(ids(".refresherDuplicate")).toEqual(["c2", "c3"]);
    });

    it("짧거나 덜 반복된 댓글은 접지 않는다", async () => {
        document.body.innerHTML = VIEW([comment("c1", "a", "ㅋ"), comment("c2", "b", "ㅋ"), comment("c3", "c", "ㅋ"), comment("c4", "d", "두 번"), comment("c5", "e", "두 번")]);
        await start(FOLD);
        await tick();
        expect(document.querySelector(".refresherDuplicate, .refresherDuplicateBadge")).toBeNull();
    });

    it("가린 댓글은 세지 않고, 가린 것이 바뀌면 다시 접는다", async () => {
        document.body.innerHTML = VIEW([comment("c1", "spam", "도배 글"), comment("c2", "b", "도배 글"), comment("c3", "c", "도배 글"), comment("c4", "d", "도배 글"), comment("c5", "e", "도배 글")]);
        setBlockLists({NICK: [entry("spam")]});
        await start(FOLD);
        await tick();
        expect(ids(".refresherDuplicateBadge")).toEqual(["c2"]);
        expect(document.querySelector(".refresherDuplicateBadge")?.textContent).toBe("같은 댓글 ×4");

        // userinfo가 깡계를 가렸다고 알리면 그 댓글을 빼고 다시 접는다.
        document.getElementById("c2")!.classList.add("refresherLowActivityHide");
        document.dispatchEvent(new Event(ROWS_HIDDEN_EVENT));
        expect(ids(".refresherDuplicateBadge")).toEqual(["c3"]);
        expect(document.querySelector(".refresherDuplicateBadge")?.textContent).toBe("같은 댓글 ×3");
        expect(ids(".refresherDuplicate")).toEqual(["c4", "c5"]);
    });

    it("꺼져 있으면 접지 않는다", async () => {
        document.body.innerHTML = VIEW([comment("c1", "a", "도배 글"), comment("c2", "b", "도배 글"), comment("c3", "c", "도배 글")]);
        await start();
        await tick();
        expect(document.querySelector(".refresherDuplicate")).toBeNull();
    });
});
