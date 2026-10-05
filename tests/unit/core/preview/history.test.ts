import {afterEach, describe, expect, it} from "vitest";

import {historyDoc, ownPreviewDepth, ownPreviewEntry, previewEntry} from "@/core/preview/history";

afterEach(() => history.replaceState(null, ""));

describe("previewEntry", () => {
    it("refresher 1과 숫자 doc이 있으면 미리보기 항목이다", () => {
        const state = {refresher: 1, doc: 123, depth: 2};
        expect(previewEntry(state)).toBe(state);
    });

    it("모양이 다르면 null이다", () => {
        expect(previewEntry(null)).toBeNull();
        expect(previewEntry("x")).toBeNull();
        expect(previewEntry({refresher: 2, doc: 1})).toBeNull();
        expect(previewEntry({refresher: 1, doc: "1"})).toBeNull();
        expect(previewEntry({refresher: 1})).toBeNull();
    });
});

describe("ownPreviewEntry", () => {
    it("이 문서가 쌓은 항목만 돌려준다", () => {
        const own = {refresher: 1, doc: historyDoc};
        expect(ownPreviewEntry(own)).toBe(own);
        // 새로고침 전 문서가 쌓은 항목은 실제 이동이다.
        expect(ownPreviewEntry({refresher: 1, doc: historyDoc + 1})).toBeNull();
    });
});

describe("ownPreviewDepth", () => {
    it("지금 기록이 이 문서의 항목이면 depth다", () => {
        history.replaceState({refresher: 1, doc: historyDoc, depth: 3}, "");
        expect(ownPreviewDepth()).toBe(3);
    });

    it("다른 문서의 항목이면 0이다", () => {
        history.replaceState({refresher: 1, doc: historyDoc - 1, depth: 3}, "");
        expect(ownPreviewDepth()).toBe(0);
    });

    it("depth가 숫자가 아니거나 기록이 없으면 0이다", () => {
        history.replaceState({refresher: 1, doc: historyDoc, depth: "3"}, "");
        expect(ownPreviewDepth()).toBe(0);
        history.replaceState(null, "");
        expect(ownPreviewDepth()).toBe(0);
    });
});
