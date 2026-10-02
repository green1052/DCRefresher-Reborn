import {beforeEach, describe, expect, it, vi} from "vitest";

import {watchGifVideos} from "@/features/preview/ui/gifVideos";

describe("watchGifVideos", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        // jsdom에는 영상 재생이 없다. 프레임을 그리지 않는 영상처럼 둔다.
        Object.assign(HTMLVideoElement.prototype, {requestVideoFrameCallback: () => 0, load: () => {}});
    });

    it("3초 안에 프레임을 그리지 못한 디시콘 영상은 gif로 바꾸고, 클래스·관리자 가림·차단 표시를 옮긴다", () => {
        const root = document.createElement("div");
        root.innerHTML = `<video class="written_dccon" data-src="https://dcimg5.dcinside.com/dccon.php?no=abc&gif=1" alt="콘" data-block="1" data-blocked="hide"></video>`;
        document.body.append(root);
        const stop = watchGifVideos(root);

        vi.advanceTimersByTime(3100);
        const image = root.querySelector("img")!;
        expect(root.querySelector("video")).toBeNull();
        expect(image.className).toBe("written_dccon");
        expect(image.getAttribute("src")).toBe("https://dcimg5.dcinside.com/dccon.php?no=abc&gif=1");
        expect([image.alt, image.dataset.block, image.dataset.blocked]).toEqual(["콘", "1", "hide"]);
        stop();
        root.remove();
    });

    it("정리한 뒤에는 바꾸지 않는다", () => {
        const root = document.createElement("div");
        root.innerHTML = `<video class="written_dccon" data-src="https://dcimg5.dcinside.com/dccon.php?no=abc"></video>`;
        document.body.append(root);
        watchGifVideos(root)();

        vi.advanceTimersByTime(3100);
        expect(root.querySelector("video")).not.toBeNull();
        root.remove();
    });
});
