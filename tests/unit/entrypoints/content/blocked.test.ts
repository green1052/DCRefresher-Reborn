import {beforeEach, describe, expect, it, vi} from "vitest";

import {setBlockedHandler} from "@/core/http/client";
import {BLOCKED_PAGE_MESSAGE} from "@/core/pages";
import {warnWhenBlocked} from "@/entrypoints/content/blocked";
import {useUiStore} from "@/stores/ui";

vi.mock("@/core/http/client", () => ({setBlockedHandler: vi.fn()}));

beforeEach(() => {
    useUiStore.setState({toasts: []});
    document.head.innerHTML = "";
});

const toasts = () => useUiStore.getState().toasts;
/** HTTP 클라이언트가 빈 응답을 받았을 때 부르는 함수. */
const blockedHandler = () => vi.mocked(setBlockedHandler).mock.calls[0]![0];

describe("warnWhenBlocked", () => {
    it("지금 페이지가 비어 있으면 닫히지 않는 경고를 띄운다", () => {
        document.body.innerHTML = "  ";

        warnWhenBlocked();

        expect(toasts()).toEqual([expect.objectContaining({content: BLOCKED_PAGE_MESSAGE, type: "warning", autoClose: 0})]);
    });

    it("확장이 붙인 UI만 있으면 빈 페이지로 본다", () => {
        document.body.innerHTML = "<refresher-root></refresher-root><div data-refresher-ui></div>\n";
        warnWhenBlocked();
        expect(toasts()).toHaveLength(1);
    });

    it("디시 내용이나 글자가 있으면 띄우지 않는다", () => {
        document.body.innerHTML = "<div id='top'></div>";
        warnWhenBlocked();
        document.body.innerHTML = "<refresher-root></refresher-root>글자";
        warnWhenBlocked();
        expect(toasts()).toEqual([]);
    });

    it("알림·이동만 하는 빈 페이지는 차단이 아니다", () => {
        document.body.innerHTML = "";
        for (const code of ["location.href='/'", "history.back()", "alert('없는 글')"]) {
            document.head.innerHTML = `<script>${code}</script>`;
            warnWhenBlocked();
        }
        expect(toasts()).toEqual([]);
    });

    it("요청이 막히면 1분에 한 번만 띄운다", () => {
        vi.useFakeTimers();
        document.body.innerHTML = "<div></div>";
        warnWhenBlocked();
        const warn = blockedHandler();

        warn();
        warn();
        expect(toasts()).toHaveLength(1);

        vi.advanceTimersByTime(60_000);
        warn();
        expect(toasts()).toHaveLength(2);
    });
});
