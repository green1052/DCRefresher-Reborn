import {beforeEach, describe, expect, it} from "vitest";

import {warnWhenBlocked} from "@/entrypoints/content/blocked";
import {useUiStore} from "@/stores/ui";

describe("warnWhenBlocked", () => {
    beforeEach(() => {
        useUiStore.setState({toast: null});
        document.head.innerHTML = "";
        document.body.innerHTML = "";
    });

    it("본문이 빈 페이지는 임시 차단으로 알린다", () => {
        warnWhenBlocked();
        expect(useUiStore.getState().toast?.type).toBe("warning");
    });

    it("삭제된 글처럼 스크립트로 알림을 띄우거나 이동하는 빈 페이지는 알리지 않는다", () => {
        document.head.innerHTML = `<script>location.replace("/derror/deleted/test/gallery/gallery/1");</script>`;
        warnWhenBlocked();
        expect(useUiStore.getState().toast).toBeNull();
    });

    it("디시 내용이 있으면 알리지 않는다", () => {
        document.body.innerHTML = `<div class="dcwrap"></div>`;
        warnWhenBlocked();
        expect(useUiStore.getState().toast).toBeNull();
    });
});
