import {beforeEach, describe, expect, it} from "vitest";

import {setTitleCount} from "@/features/refresh/title";

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
