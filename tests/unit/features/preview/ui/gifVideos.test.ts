import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {watchGifVideos} from "@/features/preview/ui/gifVideos";

// jsdom에는 프레임 콜백이 없고 load()는 구현되지 않았다. 그린 프레임은 paint()로 흉내 낸다.
let frameCallbacks: (() => void)[] = [];
const paint = () => {
    for (const callback of frameCallbacks.splice(0)) callback();
};

beforeEach(() => {
    frameCallbacks = [];
    vi.useFakeTimers();
    Object.defineProperty(HTMLVideoElement.prototype, "requestVideoFrameCallback", {
        configurable: true,
        value: (callback: () => void) => frameCallbacks.push(callback)
    });
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
});
afterEach(() => void document.body.replaceChildren());

const render = (html: string): HTMLElement => {
    const root = document.createElement("div");
    root.innerHTML = html;
    document.body.append(root);
    return root;
};

const VIDEO = "<video class=\"written_dccon big\" src=\"https://dcimg5.dcinside.com/dccon.php?no=1\" data-src=\"https://dcimg5.dcinside.com/1.gif\" alt=\"콘\" title=\"제목\" data-block=\"1\" data-blocked=\"hide\"><source src=\"a.mp4\"></video>";

describe("watchGifVideos", () => {
    it("3초 안에 그리지 못하면 gif로 바꾸고 속성을 옮긴다", () => {
        const root = render(VIDEO);
        const video = root.querySelector("video");
        watchGifVideos(root);
        vi.advanceTimersByTime(2999);
        expect(root.querySelector("video")).not.toBeNull();
        vi.advanceTimersByTime(1);
        const image = root.querySelector("img");
        expect(root.querySelector("video")).toBeNull();
        expect(image?.className).toBe("written_dccon big");
        expect(image?.getAttribute("src")).toBe("https://dcimg5.dcinside.com/1.gif");
        expect(image?.loading).toBe("lazy");
        expect(["alt", "title", "data-block", "data-blocked"].map((name) => image?.getAttribute(name))).toEqual(["콘", "제목", "1", "hide"]);
        // 떼어 낸 영상은 받기를 끊는다.
        expect(video?.hasAttribute("src")).toBe(false);
        expect(video?.children).toHaveLength(0);
    });

    it("프레임을 그렸으면 바꾸지 않는다", () => {
        const root = render(VIDEO);
        watchGifVideos(root);
        paint();
        vi.advanceTimersByTime(3000);
        expect(root.querySelector("video")).not.toBeNull();
    });

    it("source 오류가 나면 바로 바꾼다", () => {
        const root = render(VIDEO);
        watchGifVideos(root);
        root.querySelector("source")?.dispatchEvent(new Event("error"));
        expect(root.querySelector("img")).not.toBeNull();
        // 이미 바꾼 영상은 다시 바꾸지 않는다.
        vi.advanceTimersByTime(3000);
        expect(root.querySelectorAll("img")).toHaveLength(1);
    });

    it("gif 주소가 없는 영상은 보지 않는다", () => {
        const root = render("<video src=\"a.mp4\"></video>");
        watchGifVideos(root);
        vi.advanceTimersByTime(3000);
        expect(root.querySelector("video")).not.toBeNull();
    });

    it("정리한 뒤에는 바꾸지 않는다", () => {
        const root = render(VIDEO);
        const stop = watchGifVideos(root);
        stop();
        vi.advanceTimersByTime(3000);
        root.querySelector("source")?.dispatchEvent(new Event("error"));
        expect(root.querySelector("video")).not.toBeNull();
    });

    it("정리할 때 문서에서 빠진 영상만 받기를 끊는다", () => {
        const root = render(`${VIDEO}<video id="kept" src="b.mp4"></video>`);
        const stop = watchGifVideos(root);
        const removed = root.querySelector("video");
        removed?.remove();
        stop();
        expect(removed?.hasAttribute("src")).toBe(false);
        expect(root.querySelector("#kept")?.getAttribute("src")).toBe("b.mp4");
    });
});
