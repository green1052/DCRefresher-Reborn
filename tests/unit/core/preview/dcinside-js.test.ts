import {describe, expect, it} from "vitest";

import {decodeD} from "@/core/preview/dcinside-js";

describe("decodeD", () => {
    // 실제 디시 글 페이지의 _d('…') 값과 디시 _d()가 푼 결과다.
    it("디시 _d()처럼 섞은 base64를 푼다", () => {
        expect(decodeD("Q+y6PM0Gdou4dgQtQ+UGPM0Ed4uERM=tQFyvPM05dTw5PM=ERTuHQSKK")).toBe("207,266,253,256,217,181,304,255.5,119,91");
        // 디시 common.js 표에서 'l'은 42번째, '1'은 59번째다. 둘을 바꿔 옮기면 'aazaa{'로 풀린다.
        expect(decodeD("WVzlWVz7")).toBe("aajaa{");
    });

    it("표에 없는 글자(개행 포함)는 버린다", () => {
        expect(decodeD("Q+y6\nPM0G!do")).toBe(decodeD("Q+y6PM0Gdo"));
    });
});
