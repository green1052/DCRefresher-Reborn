import {describe, expect, it} from "vitest";

import {historyDoc, ownPreviewDepth, ownPreviewEntry, previewEntry} from "@/core/preview/history";

const entry = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({refresher: 1, doc: historyDoc, ...overrides});

describe("기록 항목 판별", () => {
    it("미리보기가 쌓은 항목인지 모양으로 보고, 이 문서가 쌓은 것인지 doc으로 가린다", () => {
        const own = previewEntry(entry());
        expect(own).not.toBeNull();
        expect(ownPreviewEntry(entry())).not.toBeNull();

        // 모양이 다른 값은 미리보기 항목이 아니다.
        expect(previewEntry(null)).toBeNull();
        expect(previewEntry({refresher: 1, doc: "1"})).toBeNull();
        expect(previewEntry({refresher: 2, doc: historyDoc})).toBeNull();

        // 새로고침 전 문서가 쌓은 항목(doc이 다름)은 이 문서의 것이 아니다.
        expect(previewEntry(entry({doc: historyDoc - 1}))).not.toBeNull();
        expect(ownPreviewEntry(entry({doc: historyDoc - 1}))).toBeNull();
    });

    it("이 문서가 쌓은 깊이만 센다 (다른 값이면 0)", () => {
        history.replaceState(entry({depth: 3}), "");
        expect(ownPreviewDepth()).toBe(3);

        history.replaceState({refresher: 1, doc: historyDoc - 1, depth: 3}, "");
        expect(ownPreviewDepth()).toBe(0);

        history.replaceState(null, "");
        expect(ownPreviewDepth()).toBe(0);
    });
});
