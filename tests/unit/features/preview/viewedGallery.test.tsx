// @vitest-environment-options {"url": "https://gall.dcinside.com/board/lists/?id=test"}
import {render} from "preact";
import {act} from "preact/test-utils";
import {afterEach, describe, expect, it} from "vitest";

import {usePreviewStore, useViewedGallery} from "@/features/preview/ui/previewStore";

import {preData} from "../../../helpers";

describe("useViewedGallery", () => {
    const root = document.createElement("div");
    let seen: string | null = null;
    const Probe = () => {
        seen = useViewedGallery();
        return null;
    };

    afterEach(() => {
        render(null, root);
        usePreviewStore.getState().close();
        history.replaceState(null, "", "/board/lists/?id=test");
    });

    it("미리보기가 닫혀 있으면 주소가 바뀌어도 이 문서의 갤러리다", () => {
        history.replaceState(null, "", "/board/view/?id=other&no=1");
        act(() => render(<Probe/>, root));
        expect(seen).toBe("test");
    });

    it("미리보기가 열려 있으면 주소를 바꾸지 않아도 그 글의 갤러리다", () => {
        act(() => render(<Probe/>, root));
        act(() => usePreviewStore.getState().open(preData({gallery: "other", id: "1", link: "https://gall.dcinside.com/board/view/?id=other&no=1"})));
        expect(seen).toBe("other");

        act(() => usePreviewStore.getState().close());
        expect(seen).toBe("test");
    });
});
