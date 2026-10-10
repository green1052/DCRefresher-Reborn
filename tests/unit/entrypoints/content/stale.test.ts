import {beforeEach, describe, expect, it} from "vitest";

import {cleanUpStaleInstance} from "@/entrypoints/content/stale";

const html = document.documentElement;

// jsdom에는 inert 속성이 없다. 브라우저처럼 inert 특성에 잇는다.
if (!("inert" in HTMLElement.prototype)) {
    Object.defineProperty(HTMLElement.prototype, "inert", {
        get(this: HTMLElement) {
            return this.hasAttribute("inert");
        },
        set(this: HTMLElement, value: boolean) {
            this.toggleAttribute("inert", value);
        }
    });
}

beforeEach(() => {
    html.removeAttribute("style");
    html.removeAttribute("data-base-ui-scroll-locked");
    document.body.removeAttribute("style");
    document.body.innerHTML = "<div id='page' inert></div><div id='modal-sibling' aria-hidden='true' inert data-base-ui-inert></div>";
    history.replaceState(null, "", "/start");
    document.title = "처음";
});

const lockAsDeadInstance = () => {
    document.body.append(document.createElement("refresher-root"));
    html.style.overflow = "hidden";
    html.style.scrollbarGutter = "stable";
    html.setAttribute("data-base-ui-scroll-locked", "");
    document.body.style.overflowY = "hidden";
    document.body.style.position = "fixed";
};

describe("cleanUpStaleInstance", () => {
    it("죽은 인스턴스가 없으면 아무것도 하지 않는다", () => {
        html.style.overflow = "hidden";

        cleanUpStaleInstance();

        expect(html.style.overflow).toBe("hidden");
        expect(document.getElementById("page")?.inert).toBe(true);
        expect(document.getElementById("modal-sibling")?.getAttribute("aria-hidden")).toBe("true");
    });

    it("오버레이와 스크롤·클릭 잠금을 걷어 낸다", () => {
        lockAsDeadInstance();

        cleanUpStaleInstance();

        expect(document.querySelector("refresher-root")).toBeNull();
        expect(html.getAttribute("style") ?? "").toBe("");
        expect(document.body.getAttribute("style") ?? "").toBe("");
        expect(html.hasAttribute("data-base-ui-scroll-locked")).toBe(false);
        expect(document.getElementById("page")?.inert).toBe(false);
        const sibling = document.getElementById("modal-sibling")!;
        expect([sibling.hasAttribute("aria-hidden"), sibling.hasAttribute("inert"), sibling.hasAttribute("data-base-ui-inert")]).toEqual([false, false, false]);
    });

    it("미리보기만 잠갔어도 스크롤바 자리(scrollbar-gutter)까지 걷어 낸다", () => {
        document.body.append(document.createElement("refresher-root"));
        html.style.overflow = "hidden";
        html.style.scrollbarGutter = "stable";

        cleanUpStaleInstance();

        expect(html.getAttribute("style") ?? "").toBe("");
        expect(document.getElementById("page")?.inert).toBe(false);
    });

    it("<html>이 잠기지 않았으면 페이지의 inert는 그대로 둔다", () => {
        document.body.append(document.createElement("refresher-root"));

        cleanUpStaleInstance();

        expect(document.getElementById("page")?.inert).toBe(true);
    });

    it("이 문서의 미리보기가 바꾼 기록을 목록 항목으로 되돌린다", () => {
        history.replaceState({refresher: 1, doc: performance.timeOrigin, back: {url: "/list?page=2", title: "목록", state: {from: "dc"}}}, "", "/view?no=1");
        document.body.append(document.createElement("refresher-root"));

        cleanUpStaleInstance();

        expect(location.pathname + location.search).toBe("/list?page=2");
        expect(history.state).toEqual({from: "dc"});
        expect(document.title).toBe("목록");
    });

    it("다른 문서가 쌓은 기록은 건드리지 않는다", () => {
        const state = {refresher: 1, doc: performance.timeOrigin - 1, back: {url: "/list", title: "목록", state: null}};
        history.replaceState(state, "", "/view?no=1");
        document.body.append(document.createElement("refresher-root"));

        cleanUpStaleInstance();

        expect(location.pathname).toBe("/view");
        expect(document.title).toBe("처음");
    });
});
