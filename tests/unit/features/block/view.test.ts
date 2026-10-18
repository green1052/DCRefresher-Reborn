// @vitest-environment-options {"url": "https://gall.dcinside.com/board/view/?id=test&no=1"}
import {webcrypto} from "node:crypto";

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {imageHash} from "@/core/block";
import block from "@/features/block/index";
import {imageFingerprints} from "@/utils/imageFingerprint";

import {blockEntry as entry, setBlockLists, tick} from "../../../helpers";
import {type Running, runModule} from "../module";

// jsdom은 이미지를 디코딩하지 못해 지문은 테스트가 정한다.
vi.mock("@/utils/imageFingerprint", async (original) => ({...await original<typeof import("@/utils/imageFingerprint")>(), imageFingerprints: vi.fn()}));

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

describe("본문 이미지 차단", () => {
    // 해시는 주소별로 모듈에 남으므로 테스트마다 다른 주소를 쓴다.
    let seq = 0;
    const imageUrl = (): string => `https://dcimg8.dcinside.co.kr/viewimage.php?id=x&no=${seq++}`;
    const NEAR = `${"0".repeat(15)}f${"0".repeat(15)}f`;

    // 다 받은 이미지처럼 보이게 한다. 지연 로딩으로 주소가 바뀌는 것을 흉내 내려고 다시 정할 수 있게 둔다.
    const loaded = (element: HTMLImageElement, url: string): void => {
        for (const [key, value] of Object.entries({currentSrc: url, complete: true, naturalWidth: 100, naturalHeight: 100})) {
            Object.defineProperty(element, key, {value, configurable: true});
        }
    };
    const bodyImage = (url: string): HTMLImageElement => {
        const element = document.createElement("img");
        loaded(element, url);
        writeDiv().append(element);
        return element;
    };
    const fileOf = async (url: string): Promise<string> => (await imageHash(url))!.file;

    beforeEach(() => {
        document.body.innerHTML = VIEW.replace("본문에 나쁜 말", "");
        // 파일 해시에 WebCrypto(crypto.subtle)가 필요한데 jsdom의 crypto에는 없다.
        // unstubAllGlobals로 되돌리지 않는다. WXT 테스트 설정이 넣은 가짜 chrome까지 지워져 runModule이 깨진다.
        vi.stubGlobal("crypto", webcrypto);
        vi.stubGlobal("fetch", vi.fn(async () => new Response("abc")));
        vi.mocked(imageFingerprints).mockReset().mockResolvedValue([["0".repeat(32), "f".repeat(32)]]);
    });

    it("다 받은 본문 이미지를 파일 해시로 가린다", async () => {
        const url = imageUrl();
        setBlockLists({IMAGE: [entry(await fileOf(url))]});
        const image = bodyImage(url);
        await start();
        await vi.waitFor(() => expect(image.classList.contains("refresherBlocked")).toBe(true));
    });

    it("주소가 바뀌면 load 때 다시 본다", async () => {
        const url = imageUrl();
        setBlockLists({IMAGE: [entry(await fileOf(url))]});
        // 지연 로딩 자리 이미지는 viewimage.php가 아니라 보지 않는다.
        const image = bodyImage("https://gall.dcinside.com/lazy.gif");
        await start();
        await tick();
        expect(image.classList.contains("refresherBlocked")).toBe(false);

        loaded(image, url);
        image.dispatchEvent(new Event("load"));
        await vi.waitFor(() => expect(image.classList.contains("refresherBlocked")).toBe(true));
    });

    it("차단 목록이 바뀐 뒤에도 지문을 기다리지 않고 다시 가린다", async () => {
        const url = imageUrl();
        const file = entry(await fileOf(url));
        setBlockLists({IMAGE: [file, entry("다른 파일", {similar: NEAR})]});
        // 앞선 이미지들의 지문 계산이 밀려 있어 끝나지 않는다.
        vi.mocked(imageFingerprints).mockReturnValue(new Promise(() => {}));
        const image = bodyImage(url);
        await start({similarImages: true});
        await vi.waitFor(() => expect(image.classList.contains("refresherBlocked")).toBe(true));

        // recheck가 가린 것을 모두 풀고 다시 판정한다.
        setBlockLists({IMAGE: [file, entry("또 다른 파일", {similar: NEAR})]});
        await vi.waitFor(() => expect(image.classList.contains("refresherBlocked")).toBe(true), {timeout: 500});
    });

    it("지문을 기다리는 사이 비슷한 이미지 차단을 끄면 늦게 나온 지문으로 가리지 않는다", async () => {
        const fingerprint = Promise.withResolvers<[string, string][]>();
        vi.mocked(imageFingerprints).mockReturnValue(fingerprint.promise);
        setBlockLists({IMAGE: [entry("다른 파일", {similar: NEAR})]});
        const image = bodyImage(imageUrl());
        const {change} = await start({similarImages: true});
        await vi.waitFor(() => expect(imageFingerprints).toHaveBeenCalled());

        change({similarImages: false});
        fingerprint.resolve([["0".repeat(32), "f".repeat(32)]]);
        await tick();
        await tick();
        expect(image.classList.contains("refresherBlocked")).toBe(false);
    });
});
