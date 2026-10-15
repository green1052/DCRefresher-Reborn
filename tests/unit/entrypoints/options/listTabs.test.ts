import {describe, expect, it} from "vitest";

import {restoreRemoved} from "@/entrypoints/options/ListTabs";

const key = (item: string): string => item;

describe("restoreRemoved", () => {
    it("지운 항목을 지우기 전 자리에 되살린다", () => {
        expect(restoreRemoved(["b", "d"], [{index: 0, item: "a"}, {index: 2, item: "c"}, {index: 4, item: "e"}], key)).toEqual(["a", "b", "c", "d", "e"]);
    });

    it("그사이 같은 키가 다시 생겼으면 건너뛰고, 새로 생긴 항목은 지킨다", () => {
        expect(restoreRemoved(["b", "a", "x"], [{index: 0, item: "a"}, {index: 2, item: "c"}], key)).toEqual(["b", "a", "c", "x"]);
    });

    it("목록이 줄었으면 끝에 붙인다", () => {
        expect(restoreRemoved([], [{index: 3, item: "a"}, {index: 5, item: "b"}], key)).toEqual(["a", "b"]);
    });
});
