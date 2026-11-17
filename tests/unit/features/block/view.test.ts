// @vitest-environment-options {"url": "https://gall.dcinside.com/board/view/?id=test&no=1"}
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import block from "@/features/block/index";

import {blockEntry as entry, setBlockLists, tick} from "../../../helpers";
import {type Running, runModule} from "../module";

const comment = (text: string): string =>
    `<li class="ub-content"><span class="ub-writer" data-nick="ㅇㅇ" data-uid="" data-ip="1.2"></span><p class="usertxt">${text}</p></li>`;

const VIEW =
    "<div class=\"gallview_head ub-content\"><h3><span class=\"title_subject\">제목</span></h3>" +
    "<div class=\"gall_writer ub-writer\" data-nick=\"글쓴이\" data-uid=\"\" data-ip=\"\"></div></div>" +
    "<div class=\"writing_view_box\"><div class=\"write_div\">본문에 나쁜 말</div></div>";

let running: Running<unknown> | undefined;
const start = async (patch = {}) => (running = await runModule(block, patch));

const writeDiv = (): HTMLElement => document.querySelector(".write_div")!;
const notices = (): number => document.querySelectorAll(".refresherTextNotice").length;

beforeEach(() => {
    document.body.innerHTML = "";
    setBlockLists();
});

afterEach(() => {
    running?.stop();
    running = undefined;
});

describe("같은 댓글 접기", () => {
    it("배지를 넣어도 댓글 목록을 다시 접지 않는다", async () => {
        running = await runModule(block, {foldDuplicate: true, duplicateCount: 2, duplicateMinLength: 1});
        const list = Object.assign(document.createElement("ul"), {className: "cmt_list", innerHTML: comment("도배 글") + comment("도배 글")});
        const scans = vi.spyOn(list, "querySelectorAll");
        document.body.append(list);
        // 필터가 접고, 넣은 배지로 목록이 다시 잡히는지 한 차례 더 기다린다.
        await tick();
        await tick();

        expect(list.querySelector(".refresherDuplicateBadge")?.textContent).toBe("같은 댓글 ×2");
        expect(scans.mock.calls.filter(([selector]) => selector === "li.ub-content")).toHaveLength(1);
    });

    it("접은 댓글의 답글 칸도 같이 접는다", async () => {
        // 디시는 댓글의 답글을 다음 형제 <li>의 .reply 안에 그린다.
        const replies = "<li id=\"replies\"><div class=\"reply show\"><ul class=\"reply_list\">" + comment("도배 그만") + "</ul></div></li>";
        document.body.innerHTML = `<ul class="cmt_list">${comment("도배 글")}${comment("다른 글")}${comment("도배 글")}${replies}</ul>`;
        const {change} = await start({foldDuplicate: true, duplicateCount: 2, duplicateMinLength: 1});
        await tick();
        const container = document.querySelector("#replies")!;
        expect(container.classList.contains("refresherDuplicate")).toBe(true);

        change({foldDuplicate: false});
        expect(container.classList.contains("refresherDuplicate")).toBe(false);
    });

    it("같이 접힌 답글은 세지 않아 다른 댓글의 같은 답글을 남긴다", async () => {
        const replies = (id: string): string => `<li id="${id}"><div class="reply show"><ul class="reply_list">${comment("도배 그만")}</ul></div></li>`;
        document.body.innerHTML = `<ul class="cmt_list">${comment("도배 글")}${comment("도배 글")}${replies("folded")}${comment("다른 글")}${replies("kept")}</ul>`;
        await start({foldDuplicate: true, duplicateCount: 2, duplicateMinLength: 1});
        await tick();

        expect(document.querySelector("#folded")!.classList.contains("refresherDuplicate")).toBe(true);
        const kept = document.querySelector("#kept li")!;
        expect(kept.classList.contains("refresherDuplicate")).toBe(false);
        expect(kept.closest(".refresherDuplicate")).toBeNull();
        expect(document.querySelector("#folded .refresherDuplicateBadge")).toBeNull();
    });
});

describe("본문 차단", () => {
    beforeEach(() => {
        document.body.innerHTML = VIEW;
    });

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

