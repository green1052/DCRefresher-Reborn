// @vitest-environment-options {"url": "https://gall.dcinside.com/board/lists/?id=test"}
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import layout from "@/features/layout/index";
import {HIDE_OPTIONS} from "@/features/layout/meta";

import {type Running, runModule} from "../module";

/** 창 폭 matchMedia. narrow를 바꾸고 notify로 change를 보낸다. */
const media = {narrow: false, queries: new Array<string>(), listeners: new Set<() => void>()};
const notify = (narrow: boolean): void => {
    media.narrow = narrow;
    for (const listener of media.listeners) listener();
};

beforeEach(() => {
    media.narrow = false;
    media.queries.length = 0;
    media.listeners.clear();
    vi.stubGlobal("matchMedia", (query: string) => {
        media.queries.push(query);
        return {
            get matches() {
                return media.narrow;
            },
            addEventListener: (_type: string, listener: () => void, {signal}: { signal: AbortSignal }) => {
                media.listeners.add(listener);
                signal.addEventListener("abort", () => media.listeners.delete(listener));
            }
        };
    });
    history.replaceState(null, "", "/board/lists/?id=test");
});

let running: Running<void> | undefined;
const start = async (patch = {}) => (running = await runModule(layout, patch));

afterEach(() => {
    running?.stop();
    running = undefined;
});

const root = document.documentElement;
const css = (): string => document.querySelector("style#refresher-layout-hide")?.textContent ?? "";

describe("숨기기", () => {
    it("켠 영역마다 규칙을 따로 쓴다", async () => {
        await start({hideGalleryImage: true, removeAi: true});
        expect(css().split("\n")).toEqual([
            `${HIDE_OPTIONS.hideGalleryImage.selector} { display: none !important; }`,
            `${HIDE_OPTIONS.removeAi.selector} { display: none !important; }`
        ]);
    });

    it("공지 모아보기에서는 공지를 숨기지 않는다", async () => {
        history.replaceState(null, "", "/board/lists/?id=test&exception_mode=notice");
        await start({removeNotice: true, removeDCNotice: true, removeAi: true});
        expect(css()).toBe(`${HIDE_OPTIONS.removeAi.selector} { display: none !important; }`);
    });

    it("본문 확장은 잡다 링크를 숨겼을 때만 한다", async () => {
        const {change} = await start({pushToRight: true});
        expect(root.classList.contains("refresherPushToRight")).toBe(false);
        change({hideUselessView: true});
        expect(root.classList.contains("refresherPushToRight")).toBe(true);
    });

    it("공지 숨기기 선택자는 공지 행과 운영자 글만 고른다", () => {
        document.body.innerHTML = "<table><tbody>" +
            "<tr id=\"notice\" class=\"ub-content\"><td class=\"gall_num\"><em class=\"icon_notice\"></em></td></tr>" +
            "<tr id=\"admin\" class=\"ub-content\"><td class=\"ub-writer\" data-nick=\"운영자\" data-uid=\"\" data-ip=\"\"></td></tr>" +
            "<tr id=\"named\" class=\"ub-content\"><td class=\"ub-writer\" data-nick=\"운영자\" data-uid=\"fake\" data-ip=\"\"></td></tr>" +
            "<tr id=\"poll\" class=\"ub-content\"><td user_name=\"운영자\"></td></tr>" +
            "</tbody></table>";
        const ids = (selector: string): string[] => Array.from(document.querySelectorAll(selector), (element) => element.id);
        expect(ids(HIDE_OPTIONS.removeNotice.selector)).toEqual(["notice"]);
        // 운영자라는 닉네임의 회원 글은 숨기지 않는다.
        expect(ids(HIDE_OPTIONS.removeDCNotice.selector)).toEqual(["admin", "poll"]);
        document.body.innerHTML = "";
    });
});

describe("컴팩트 모드", () => {
    it("창 폭이 기준보다 좁아질 때 켠다", async () => {
        await start({activePixel: 800});
        expect(media.queries).toEqual(["(max-width: 800px)"]);
        expect(root.classList.contains("refresherCompact")).toBe(false);
        notify(true);
        expect(root.classList.contains("refresherCompact")).toBe(true);
    });

    it("기준을 바꾸면 새 기준만 본다", async () => {
        const {change} = await start({activePixel: 800});
        change({activePixel: 1200});
        expect(media.queries.at(-1)).toBe("(max-width: 1200px)");
        expect(media.listeners.size).toBe(1);
    });

    it("강제 사용이면 넓어도 켠다", async () => {
        const {change} = await start();
        change({forceCompact: true});
        expect(root.classList.contains("refresherCompact")).toBe(true);
    });

    it("모듈을 끄면 클래스·규칙·감시를 뗀다", async () => {
        const {stop} = await start({forceCompact: true, hideUselessView: true, pushToRight: true});
        stop();
        running = undefined;
        expect(root.classList.contains("refresherCompact")).toBe(false);
        expect(root.classList.contains("refresherPushToRight")).toBe(false);
        expect(document.querySelector("style#refresher-layout-hide")).toBeNull();
        expect(media.listeners.size).toBe(0);
    });
});
