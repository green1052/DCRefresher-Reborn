import {afterEach, describe, expect, it, vi} from "vitest";

import {onBfcacheRestore, smoothScroll, whenDomReady, writeStyle} from "@/utils/dom";

import {tick} from "../../helpers";

afterEach(() => {
    for (const style of document.querySelectorAll("style")) style.remove();
});

/** matchMedia가 query마다 matches를 돌려주게 한다 (jsdom에는 없다). */
const stubMatchMedia = (matches: boolean): void => {
    vi.stubGlobal("matchMedia", (media: string) => ({matches, media}));
};

describe("whenDomReady", () => {
    it("다 읽었으면 바로 부른다", () => {
        const run = vi.fn();
        whenDomReady(run);
        expect(run).toHaveBeenCalledTimes(1);
    });

    it("읽는 중이면 DOMContentLoaded에 한 번 부른다", () => {
        vi.spyOn(document, "readyState", "get").mockReturnValue("loading");
        const run = vi.fn();
        whenDomReady(run);
        expect(run).not.toHaveBeenCalled();
        document.dispatchEvent(new Event("DOMContentLoaded"));
        document.dispatchEvent(new Event("DOMContentLoaded"));
        expect(run).toHaveBeenCalledTimes(1);
    });

    it("signal이 abort되면 부르지 않는다", () => {
        vi.spyOn(document, "readyState", "get").mockReturnValue("loading");
        const run = vi.fn();
        const controller = new AbortController();
        whenDomReady(run, controller.signal);
        controller.abort();
        document.dispatchEvent(new Event("DOMContentLoaded"));
        expect(run).not.toHaveBeenCalled();
    });
});

describe("onBfcacheRestore", () => {
    it("bfcache에서 돌아올 때만 부르고, signal로 뗀다", async () => {
        const run = vi.fn(async () => {});
        const controller = new AbortController();
        onBfcacheRestore(run, controller.signal);

        window.dispatchEvent(new PageTransitionEvent("pageshow", {persisted: false}));
        expect(run).not.toHaveBeenCalled();
        window.dispatchEvent(new PageTransitionEvent("pageshow", {persisted: true}));
        expect(run).toHaveBeenCalledTimes(1);

        controller.abort();
        window.dispatchEvent(new PageTransitionEvent("pageshow", {persisted: true}));
        expect(run).toHaveBeenCalledTimes(1);
    });

    it("실패는 콘솔에 남기고 던지지 않는다", async () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        const controller = new AbortController();
        onBfcacheRestore(async () => {
            throw new Error("실패");
        }, controller.signal);
        window.dispatchEvent(new PageTransitionEvent("pageshow", {persisted: true}));
        await tick();
        expect(error).toHaveBeenCalled();
        controller.abort();
    });
});

describe("smoothScroll", () => {
    it("동작 줄이기를 켰으면 바로 옮긴다", () => {
        stubMatchMedia(true);
        expect(smoothScroll()).toBe("auto");
        stubMatchMedia(false);
        expect(smoothScroll()).toBe("smooth");
    });
});

describe("writeStyle", () => {
    it("<html>에 style을 만들고 같은 id면 이어 쓴다", () => {
        writeStyle("refresher-test", "a {}");
        writeStyle("refresher-test", "b {}");
        const styles = document.querySelectorAll("style#refresher-test");
        expect(styles).toHaveLength(1);
        expect(styles[0]?.parentElement).toBe(document.documentElement);
        expect(styles[0]?.textContent).toBe("b {}");
    });

    it("죽은 인스턴스가 남긴 style도 찾아 쓴다", () => {
        const old = document.head.appendChild(Object.assign(document.createElement("style"), {id: "refresher-test", textContent: "old {}"}));
        writeStyle("refresher-test", "new {}");
        expect(old.textContent).toBe("new {}");
        expect(document.querySelectorAll("style#refresher-test")).toHaveLength(1);
    });
});
