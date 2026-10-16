// @vitest-environment-options {"url": "https://gall.dcinside.com/board/lists/?id=test"}
import {afterEach, describe, expect, it} from "vitest";

import {previewGallery, usePreviewStore} from "@/features/preview/ui/previewStore";
import {selectedGallery} from "@/stores/ui";

import {preData} from "../../../helpers";

describe("버블·메모 창의 갤러리", () => {
    afterEach(() => {
        usePreviewStore.getState().close();
        history.replaceState(null, "", "/board/lists/?id=test");
    });

    it("미리보기가 닫혀 있으면 주소가 바뀌어도 이 문서의 갤러리다", () => {
        history.replaceState(null, "", "/board/view/?id=other&no=1");
        expect(selectedGallery(previewGallery())).toBe("test");
    });

    it("미리보기가 열려 있으면 주소를 바꾸지 않아도 그 글의 갤러리다", () => {
        usePreviewStore.getState().open(preData({gallery: "other", id: "1", link: "https://gall.dcinside.com/board/view/?id=other&no=1"}));
        expect(selectedGallery(previewGallery())).toBe("other");

        usePreviewStore.getState().close();
        expect(selectedGallery(previewGallery())).toBe("test");
    });
});
