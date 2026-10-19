// @vitest-environment-options {"url": "https://gall.dcinside.com/board/lists/?id=test"}
import {afterEach, expect, it, vi} from "vitest";

import preview from "@/features/preview/index";

import {type Running, runModule} from "../module";

let running: Running<unknown> | undefined;

afterEach(() => {
    running?.stop();
    running = undefined;
    vi.unstubAllGlobals();
});

it("listKeyboard를 끄면 J로 고른 행의 선택을 푼다", async () => {
    // jsdom에는 없는 API. 행은 다 보이는 것으로 친다.
    Element.prototype.checkVisibility = () => true;
    Element.prototype.scrollIntoView = () => undefined;
    vi.stubGlobal("matchMedia", () => ({matches: false}));
    document.body.innerHTML =
        "<table class=\"gall_list\"><tbody><tr class=\"ub-content\"><td class=\"gall_tit\"><a href=\"/board/view/?id=test&no=7\">제목</a></td></tr></tbody></table>";
    running = await runModule(preview, {listKeyboard: true});
    const row = document.querySelector(".ub-content")!;

    window.dispatchEvent(new KeyboardEvent("keydown", {code: "KeyJ", cancelable: true}));
    expect(row.classList.contains("refresherSelected")).toBe(true);

    running.change({listKeyboard: false});
    expect(row.classList.contains("refresherSelected")).toBe(false);
});
