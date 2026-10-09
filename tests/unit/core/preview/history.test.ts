import {describe, expect, it} from "vitest";

import {previewEntry} from "@/core/preview/history";

import {preData} from "../../../helpers";

const link = "https://gall.dcinside.com/board/view/?id=test&no=1";
const back = {title: "목록", url: "/list", state: null};
const entry = (fields: Record<string, unknown>) => ({refresher: 1, doc: 1, preData: preData({link}), back, depth: 2, ...fields});

describe("previewEntry", () => {
    it("미리보기가 쌓은 항목을 그대로 읽는다", () => {
        expect(previewEntry(entry({reopen: true}))).toEqual({refresher: 1, doc: 1, preData: preData({link}), back, depth: 2, reopen: true});
    });

    it("미리보기가 쌓지 않은 기록은 null이다", () => {
        expect(previewEntry(null)).toBeNull();
        expect(previewEntry({from: "dc"})).toBeNull();
        expect(previewEntry({refresher: 1, doc: "1"})).toBeNull();
    });

    it("디시 주소가 아닌 링크의 preData는 버린다", () => {
        for (const bad of ["javascript:alert(1)", "https://example.com/board/view/?id=test&no=1", "http://gall.dcinside.com/board/view/?id=test&no=1", ""]) {
            expect(previewEntry(entry({preData: preData({link: bad})}))?.preData).toBeUndefined();
        }
    });

    it("모양이 어긋난 preData는 버린다", () => {
        for (const bad of [{...preData({link}), commentCount: undefined}, {...preData({link}), commentCount: Number.NaN}, {...preData({link}), gallery: 1}, {...preData({link}), title: null}, "글"]) {
            expect(previewEntry(entry({preData: bad}))?.preData).toBeUndefined();
        }
    });

    it("모양이 어긋난 back은 버리고 preData는 남긴다", () => {
        const result = previewEntry(entry({back: {url: 1, title: "목록"}}));
        expect(result?.back).toBeUndefined();
        expect(result?.preData).toEqual(preData({link}));
    });
});
