import {beforeEach, describe, expect, it, vi} from "vitest";

import {setTitleCount} from "@/features/refresh/title";

beforeEach(() => {
    document.documentElement.removeAttribute("data-refresher-title-count");
    document.title = "갤러리";
});

describe("setTitleCount", () => {
    it("수를 붙이고 바꾸고 뗀다", () => {
        setTitleCount(3);
        expect(document.title).toBe("(3) 갤러리");
        setTitleCount(5);
        expect(document.title).toBe("(5) 갤러리");
        setTitleCount(0);
        expect(document.title).toBe("갤러리");
    });

    it("원래 \"(1) \"로 시작하는 제목은 건드리지 않는다", () => {
        document.title = "(1) 글 제목";
        setTitleCount(0);
        expect(document.title).toBe("(1) 글 제목");
        setTitleCount(2);
        expect(document.title).toBe("(2) (1) 글 제목");
    });

    it("다시 넣은 인스턴스도 옛 인스턴스가 붙인 수를 뗀다", async () => {
        setTitleCount(3);
        // 파이어폭스 재주입: 모듈을 새로 불러온 인스턴스.
        vi.resetModules();
        const {setTitleCount: fresh} = await import("@/features/refresh/title");
        fresh(0);
        expect(document.title).toBe("갤러리");
    });
});
