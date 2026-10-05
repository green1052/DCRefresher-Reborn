// @vitest-environment-options {"url": "https://gall.dcinside.com/board/write/?id=test"}
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import write from "@/features/write/index";

import {tick} from "../../../helpers";
import {type Running, runModule} from "../module";

const sendMessage = vi.hoisted(() => vi.fn<(type: string) => Promise<void>>());
vi.mock("@/core/messaging/protocol", () => ({sendMessage}));

const FORM = "<input id=\"subject\"><div class=\"note-editable\"></div><button class=\"write\">등록</button>" +
    "<div id=\"leave_confirm_box\"><button class=\"btn_blue\">확인</button></div>";

let running: Running<void> | undefined;
const start = async (patch = {}) => (running = await runModule(write, patch));

/** 떠나려 할 때 확인을 띄우는지. */
const blocksExit = (): boolean => {
    const ev = new Event("beforeunload", {cancelable: true});
    window.dispatchEvent(ev);
    return ev.defaultPrevented;
};

const editor = (): HTMLElement => document.querySelector(".note-editable")!;
const subject = (): HTMLInputElement => document.querySelector<HTMLInputElement>("#subject")!;
const type = (target: Element): void => void target.dispatchEvent(new Event("input", {bubbles: true}));

beforeEach(() => {
    history.replaceState(null, "", "/board/write/?id=test");
    document.body.innerHTML = FORM;
    sendMessage.mockResolvedValue(undefined);
});

afterEach(() => {
    running?.stop();
    running = undefined;
});

describe("업로드 설정", () => {
    const options = (): unknown => {
        const raw = document.documentElement.dataset.refresherUpload;
        return raw === undefined ? undefined : JSON.parse(raw);
    };

    // hookUploads는 페이지마다 한 번만 넣어 달라고 하므로(모듈 상태) 이 describe의 테스트는 순서대로 이어진다.
    it("둘 다 꺼져 있으면 두지 않고 hookUploads도 부르지 않는다", async () => {
        await start();
        expect(options()).toBeUndefined();
        expect(sendMessage).not.toHaveBeenCalled();
    });

    it("넣어 달라는 요청이 실패하면 다음에 다시 한다", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        sendMessage.mockRejectedValueOnce(new Error("배경 없음"));
        const {change} = await start({obfuscateName: true});
        await tick();
        change({webpQuality: 60});
        expect(sendMessage).toHaveBeenCalledTimes(2);
    });

    it("켜면 설정을 <html>에 두고, 끄면 지운다", async () => {
        const {change} = await start({webpConvert: true, webpQuality: 70});
        expect(options()).toEqual({webp: true, quality: 0.7, rename: false});
        // 이미 넣어 달라고 했으면 다시 보내지 않는다.
        expect(sendMessage).not.toHaveBeenCalled();

        change({obfuscateName: true});
        expect(options()).toEqual({webp: true, quality: 0.7, rename: true});
        change({webpConvert: false, obfuscateName: false});
        expect(options()).toBeUndefined();
    });

    it("모듈을 끄면 지운다", async () => {
        const {stop} = await start({obfuscateName: true});
        stop();
        running = undefined;
        expect(options()).toBeUndefined();
    });
});

describe("나가기 방지", () => {
    it("빈 글은 막지 않는다", async () => {
        await start();
        expect(blocksExit()).toBe(false);
    });

    it("제목·본문 글자·본문 이미지가 있으면 막는다", async () => {
        await start();
        subject().value = "제목";
        expect(blocksExit()).toBe(true);

        subject().value = "";
        editor().innerHTML = "<p>본문</p>";
        expect(blocksExit()).toBe(true);

        editor().innerHTML = "<p><img src=\"a.png\"></p>";
        expect(blocksExit()).toBe(true);
    });

    it("디시가 넣은 자동 짤방·작성 가이드는 쓴 글로 보지 않는다", async () => {
        editor().innerHTML = "<div id=\"auto_zzal_img_div\"><img src=\"z.png\">짤방</div><div class=\"wrt_guide_preview_inn\">가이드</div>";
        await start();
        expect(blocksExit()).toBe(false);
    });

    it("등록을 누른 뒤에는 막지 않고, 다시 고치면 막는다", async () => {
        await start();
        subject().value = "제목";
        document.querySelector<HTMLButtonElement>("button.write")!.click();
        expect(blocksExit()).toBe(false);
        type(subject());
        expect(blocksExit()).toBe(true);
    });

    it("디시 성공 표시가 있으면 그것을 본다", async () => {
        document.body.insertAdjacentHTML("beforeend", "<input id=\"clickbutton\" value=\"N\">");
        await start();
        subject().value = "제목";
        document.querySelector<HTMLButtonElement>("button.write")!.click();
        // 등록이 실패(alert)하면 N 그대로라 계속 막는다.
        expect(blocksExit()).toBe(true);
        document.querySelector<HTMLInputElement>("#clickbutton")!.value = "Y";
        expect(blocksExit()).toBe(false);
    });

    it("디시 취소 레이어에서 나가겠다고 하면 막지 않는다", async () => {
        await start();
        subject().value = "제목";
        document.querySelector<HTMLButtonElement>("#leave_confirm_box .btn_blue")!.click();
        expect(blocksExit()).toBe(false);
    });

    it("설정을 끄면 막지 않는다", async () => {
        const {change} = await start();
        subject().value = "제목";
        change({preventExit: false});
        expect(blocksExit()).toBe(false);
    });

    it("컨텍스트가 무효화돼도 계속 막고, 모듈을 끄면 푼다", async () => {
        const {abort, stop} = await start();
        subject().value = "제목";
        abort();
        expect(blocksExit()).toBe(true);
        stop();
        running = undefined;
        expect(blocksExit()).toBe(false);
    });

    it("글쓰기 페이지가 아니면 걸지 않는다", async () => {
        history.replaceState(null, "", "/upload/image?id=test");
        await start();
        subject().value = "제목";
        expect(blocksExit()).toBe(false);
    });
});

describe("수정 페이지", () => {
    beforeEach(() => {
        history.replaceState(null, "", "/board/modify/?id=test&no=1");
        subject().value = "원래 제목";
        editor().innerHTML = "<p>원래 본문</p>";
    });

    it("고치기 전에는 막지 않는다", async () => {
        await start();
        expect(blocksExit()).toBe(false);
        type(subject());
        expect(blocksExit()).toBe(true);
    });

    it("디시가 채우는 변화는 무시하고, 건드린 뒤의 에디터 변화로 고친 것을 안다", async () => {
        await start();
        editor().append(document.createElement("p"));
        await tick();
        expect(blocksExit()).toBe(false);

        document.dispatchEvent(new Event("pointerdown"));
        editor().append(Object.assign(document.createElement("img"), {src: "new.png"}));
        await tick();
        expect(blocksExit()).toBe(true);
    });
});
