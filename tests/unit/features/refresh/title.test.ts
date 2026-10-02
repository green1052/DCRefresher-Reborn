import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import type {Ctx} from "@/features/refresh/meta";
import {createUnseenCounter, setTitleCount} from "@/features/refresh/title";

beforeEach(() => {
    // 붙여 둔 수를 떼어 다음 테스트가 깨끗한 상태에서 시작하게 한다.
    setTitleCount(0);
    document.title = "테스트 갤러리";
});

describe("setTitleCount", () => {
    it("수를 붙이고 갈아 쓴다. 겹쳐 붙이지 않는다", () => {
        setTitleCount(3);
        expect(document.title).toBe("(3) 테스트 갤러리");
        setTitleCount(5);
        expect(document.title).toBe("(5) 테스트 갤러리");
        setTitleCount(0);
        expect(document.title).toBe("테스트 갤러리");
    });

    it("원래 (1)로 시작하는 제목은 붙인 적이 없으면 건드리지 않는다", () => {
        document.title = "(1) 공략 정리 - 갤러리";
        setTitleCount(0);
        expect(document.title).toBe("(1) 공략 정리 - 갤러리");
        setTitleCount(2);
        expect(document.title).toBe("(2) (1) 공략 정리 - 갤러리");
        setTitleCount(0);
        expect(document.title).toBe("(1) 공략 정리 - 갤러리");
    });

    it("붙인 뒤 제목이 바뀌어도(미리보기) 앞의 수만 뗀다", () => {
        setTitleCount(4);
        document.title = "(4) 글 제목 - 테스트 갤러리";
        setTitleCount(0);
        expect(document.title).toBe("글 제목 - 테스트 갤러리");
    });
});

describe("createUnseenCounter", () => {
    let controller: AbortController;
    let watching = false;
    const ctx = (titleCount = true): Ctx => ({
        settings: {titleCount},
        signal: controller.signal,
        addCleanup: (cleanup: () => void) => controller.signal.addEventListener("abort", cleanup)
    }) as unknown as Ctx;
    // jsdom에는 checkVisibility가 없다. 보이는 행으로 둔다.
    const rows = (n: number): HTMLElement[] => Array.from({length: n}, () => {
        const row = document.body.appendChild(document.createElement("tr"));
        return Object.assign(row, {checkVisibility: () => true});
    });

    beforeEach(() => {
        controller = new AbortController();
        watching = false;
        vi.useFakeTimers();
        vi.spyOn(document, "hasFocus").mockImplementation(() => watching);
    });
    afterEach(() => {
        controller.abort();
        vi.useRealTimers();
    });

    it("보지 않는 동안 들어온 글을 더해 붙이고, 창 포커스나 탭 표시로 돌아오면 지운다", () => {
        const unseen = createUnseenCounter(ctx());
        unseen.count(rows(2));
        unseen.count(rows(1));
        vi.runAllTimers();
        expect(document.title).toBe("(3) 테스트 갤러리");

        watching = true;
        window.dispatchEvent(new Event("focus"));
        expect(document.title).toBe("테스트 갤러리");

        watching = false;
        unseen.count(rows(1));
        vi.runAllTimers();
        expect(document.title).toBe("(1) 테스트 갤러리");
        watching = true;
        document.dispatchEvent(new Event("visibilitychange"));
        expect(document.title).toBe("테스트 갤러리");
    });

    it("보고 있거나 설정을 끄면 세지 않고, 모듈이 멈추면 붙인 수를 뗀다", () => {
        watching = true;
        createUnseenCounter(ctx()).count(rows(2));
        vi.runAllTimers();
        expect(document.title).toBe("테스트 갤러리");

        watching = false;
        createUnseenCounter(ctx(false)).count(rows(2));
        vi.runAllTimers();
        expect(document.title).toBe("테스트 갤러리");

        createUnseenCounter(ctx()).count(rows(2));
        vi.runAllTimers();
        expect(document.title).toBe("(2) 테스트 갤러리");
        controller.abort();
        expect(document.title).toBe("테스트 갤러리");
    });
});
