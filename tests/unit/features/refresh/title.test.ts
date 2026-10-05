import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";

import type {Ctx} from "@/features/refresh/meta";
import {createUnseenCounter, setTitleCount} from "@/features/refresh/title";

import {tick} from "../../../helpers";

beforeEach(() => {
    document.title = "갤러리";
});

afterEach(() => {
    setTitleCount(0);
    document.body.innerHTML = "";
});

describe("setTitleCount", () => {
    it("제목 앞에 수를 붙이고 갈아 쓰고 뗀다", () => {
        setTitleCount(3);
        expect(document.title).toBe("(3) 갤러리");
        setTitleCount(5);
        expect(document.title).toBe("(5) 갤러리");
        setTitleCount(0);
        expect(document.title).toBe("갤러리");
    });

    it("원래 (1)로 시작하는 제목은 건드리지 않는다", () => {
        document.title = "(1) 원래 제목";
        setTitleCount(0);
        expect(document.title).toBe("(1) 원래 제목");
        setTitleCount(2);
        expect(document.title).toBe("(2) (1) 원래 제목");
        setTitleCount(0);
        expect(document.title).toBe("(1) 원래 제목");
    });

    it("미리보기가 제목을 바꿔도 앞의 수만 갈아 쓴다", () => {
        setTitleCount(3);
        document.title = "글 제목";
        setTitleCount(4);
        expect(document.title).toBe("(4) 글 제목");
    });
});

describe("createUnseenCounter", () => {
    beforeAll(() => {
        // jsdom에는 checkVisibility가 없다. hidden 조상으로 숨긴 것을 안 보이는 것으로 본다.
        Object.defineProperty(Element.prototype, "checkVisibility", {
            configurable: true,
            value(this: Element) {
                return this.closest("[hidden]") === null;
            }
        });
    });
    afterAll(() => {
        Reflect.deleteProperty(Element.prototype, "checkVisibility");
    });

    let controller: AbortController;
    let titleCount = true;
    const cleanups: (() => void)[] = [];

    const context = (): Ctx => {
        controller = new AbortController();
        return {
            settings: {
                refreshRate: 5000,
                fadeIn: true,
                useBetterBrowse: true,
                noRefreshOnSearch: true,
                pauseOnHover: false,
                get titleCount() {
                    return titleCount;
                },
                backgroundRefresh: false,
                backgroundRefreshRate: 30000,
                doNotColorVisited: false
            },
            signal: controller.signal,
            addFilter: () => () => {},
            addCleanup: (dispose) => void cleanups.push(dispose),
            onSettingsChanged: () => {}
        };
    };

    const rows = (count: number): HTMLElement[] => Array.from({length: count}, () => document.body.appendChild(document.createElement("tr")));

    let focused = false;
    beforeEach(() => {
        titleCount = true;
        focused = false;
        cleanups.length = 0;
        vi.spyOn(document, "hasFocus").mockImplementation(() => focused);
    });
    afterEach(() => controller.abort());

    it("탭을 보지 않는 동안 들어온 새 글을 센다", async () => {
        const counter = createUnseenCounter(context());
        counter.count(rows(2));
        await tick();
        expect(document.title).toBe("(2) 갤러리");
        counter.count(rows(1));
        await tick();
        expect(document.title).toBe("(3) 갤러리");
    });

    it("가린 글·떨어진 글은 세지 않는다", async () => {
        const counter = createUnseenCounter(context());
        const [visible, hidden, blurred, detached] = rows(4);
        hidden!.hidden = true;
        blurred!.classList.add("refresherLowActivityBlur");
        detached!.remove();
        counter.count([visible!, hidden!, blurred!, detached!]);
        await tick();
        expect(document.title).toBe("(1) 갤러리");
    });

    it("보고 있거나 설정을 끄면 세지 않는다", async () => {
        focused = true;
        const counter = createUnseenCounter(context());
        counter.count(rows(2));
        await tick();
        expect(document.title).toBe("갤러리");

        focused = false;
        titleCount = false;
        counter.count(rows(2));
        await tick();
        expect(document.title).toBe("갤러리");
    });

    it("탭으로 돌아오면 지운다", async () => {
        const counter = createUnseenCounter(context());
        counter.count(rows(2));
        await tick();

        window.dispatchEvent(new Event("focus"));
        expect(document.title).toBe("(2) 갤러리");

        focused = true;
        window.dispatchEvent(new Event("focus"));
        expect(document.title).toBe("갤러리");

        // 지운 뒤에는 처음부터 다시 센다.
        focused = false;
        counter.count(rows(1));
        await tick();
        expect(document.title).toBe("(1) 갤러리");
    });

    it("모듈이 멈추면 세지 않고 정리에서 지운다", async () => {
        const counter = createUnseenCounter(context());
        counter.count(rows(2));
        await tick();
        controller.abort();
        counter.count(rows(2));
        await tick();
        expect(document.title).toBe("(2) 갤러리");

        for (const dispose of cleanups) dispose();
        expect(document.title).toBe("갤러리");
    });
});
