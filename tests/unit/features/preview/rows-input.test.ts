/**
 * @vitest-environment-options {"url": "https://gall.dcinside.com/board/lists/?id=test"}
 */
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import type {GalleryPreData} from "@/core/preview/types";
import {bindRows} from "@/features/preview/rows-input";
import {usePreviewStore} from "@/features/preview/ui/previewStore";

import {tick} from "../../../helpers";
import {fakeCtx} from "./ctx";
import {renderList} from "./list";

const initialPreview = usePreviewStore.getState();
let stop = (): void => undefined;
beforeEach(() => usePreviewStore.setState(initialPreview, true));
afterEach(() => stop());

const start = (settings: Parameters<typeof fakeCtx>[0] = {}) => {
    const fake = fakeCtx(settings);
    stop = fake.stop;
    const opened: [string, boolean][] = [];
    const prefetched: string[] = [];
    const mini = {onMiniEnter: vi.fn(), onMiniMove: vi.fn(), onMiniLeave: vi.fn(), onMiniLeaveSoon: vi.fn()};
    bindRows(fake.ctx, {
        open: (pre: GalleryPreData, commentsOnly: boolean) => void opened.push([pre.id, commentsOnly]),
        prefetch: (pre: GalleryPreData) => void prefetched.push(pre.id),
        mini
    });
    return {opened, prefetched, mini, ...fake};
};

const find = (selector: string): HTMLElement => {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`${selector}가 없다`);
    return element;
};

const fire = (target: Element, type: string, init: MouseEventInit = {}): MouseEvent => {
    const ev = new MouseEvent(type, {bubbles: true, cancelable: true, ...init});
    target.dispatchEvent(ev);
    return ev;
};

/** 우클릭: 누르고 held ms 뒤 떼고 메뉴. */
const rightClick = (target: Element, held = 0, init: MouseEventInit = {}): MouseEvent => {
    const now = vi.spyOn(Date, "now").mockReturnValue(10_000);
    fire(target, "mousedown", {button: 2, ...init});
    now.mockReturnValue(10_000 + held);
    fire(target, "mouseup", {button: 2, ...init});
    now.mockRestore();
    return fire(target, "contextmenu", {button: 2, ...init});
};

describe("우클릭", () => {
    it("제목을 짧게 누르면 미리보기를 연다", () => {
        renderList([{no: 1}]);
        const {opened} = start();
        expect(rightClick(find(".ub-word a")).defaultPrevented).toBe(true);
        expect(opened).toEqual([["1", false]]);
    });

    it("댓글 수는 댓글만 보기로 연다", () => {
        renderList([{no: 1, comments: "[3]"}]);
        const {opened} = start();
        rightClick(find(".reply_num"));
        expect(opened).toEqual([["1", true]]);
    });

    it("행 전체 인식이 꺼져 있으면 행은 열지 않는다", () => {
        renderList([{no: 1}]);
        const {opened, settings} = start();
        expect(rightClick(find(".gall_date")).defaultPrevented).toBe(false);
        expect(opened).toEqual([]);
        settings.expandRecognizeRange = true;
        rightClick(find(".gall_date"));
        expect(opened).toEqual([["1", false]]);
    });

    it("작성자 칸은 열지 않는다", () => {
        renderList([{no: 1}]);
        const {opened} = start({expandRecognizeRange: true});
        rightClick(find(".ub-writer .nickname"));
        expect(opened).toEqual([]);
    });

    it("길게 누르면 브라우저 메뉴로 둔다", () => {
        renderList([{no: 1}]);
        const {opened} = start({longPressDelay: 300});
        expect(rightClick(find(".ub-word a"), 301).defaultPrevented).toBe(false);
        expect(opened).toEqual([]);
        // 다음 짧은 우클릭은 다시 연다.
        rightClick(find(".ub-word a"), 300);
        expect(opened).toEqual([["1", false]]);
    });

    it("Shift+우클릭은 브라우저 메뉴다", () => {
        renderList([{no: 1}]);
        const {opened, prefetched} = start();
        expect(rightClick(find(".ub-word a"), 0, {shiftKey: true}).defaultPrevented).toBe(false);
        expect(opened).toEqual([]);
        expect(prefetched).toEqual([]);
    });

    it("누르는 동안 본문을 미리 받고 오버레이를 띄운다", async () => {
        renderList([{no: 1}]);
        const {prefetched} = start();
        fire(find(".ub-word a"), "mousedown", {button: 2});
        expect(prefetched).toEqual(["1"]);
        expect(usePreviewStore.getState().warm).toBe(false);
        await tick();
        expect(usePreviewStore.getState().warm).toBe(true);
    });

    it("목록 밖이나 왼쪽 버튼은 미리 받지 않는다", () => {
        renderList([{no: 1}]);
        const {prefetched} = start();
        fire(document.body, "mousedown", {button: 2});
        fire(find(".ub-word a"), "mousedown", {button: 0});
        expect(prefetched).toEqual([]);
    });

    it("키 반전이면 열지도 미리 받지도 않는다", () => {
        renderList([{no: 1}]);
        const {opened, prefetched} = start({reversePreviewKey: true});
        // 글 주소로 이동한다 (jsdom은 이동하지 않는다).
        expect(rightClick(find(".ub-word a")).defaultPrevented).toBe(true);
        expect(opened).toEqual([]);
        expect(prefetched).toEqual([]);
    });
});

describe("좌클릭", () => {
    it("키 반전일 때만 미리보기다", () => {
        renderList([{no: 1, comments: "[2]"}]);
        const {opened, settings} = start();
        expect(fire(find(".ub-word"), "click").defaultPrevented).toBe(false);
        settings.reversePreviewKey = true;
        expect(fire(find(".ub-word"), "click").defaultPrevented).toBe(true);
        fire(find(".reply_num"), "click");
        expect(opened).toEqual([["1", false], ["1", true]]);
    });

    it("수정키 클릭은 가로채지 않는다", () => {
        renderList([{no: 1}]);
        const {opened} = start({reversePreviewKey: true});
        for (const key of ["ctrlKey", "metaKey", "shiftKey", "altKey"]) fire(find(".ub-word"), "click", {[key]: true});
        expect(opened).toEqual([]);
    });
});

describe("미니 미리보기", () => {
    it("제목 칸에 들어가고 나갈 때 부른다", () => {
        renderList([{no: 1}, {no: 2}]);
        const {mini} = start();
        const [first, second] = document.querySelectorAll(".ub-word");
        if (!first || !second) throw new Error("제목 칸이 없다");
        fire(find(".ub-word a"), "mouseover");
        expect(mini.onMiniEnter).toHaveBeenCalledWith(first, expect.any(MouseEvent));
        // 같은 칸 안에서 옮기면 떠난 것이 아니다.
        fire(first, "mouseover");
        fire(find(".ub-word a"), "mouseout", {relatedTarget: first});
        expect(mini.onMiniEnter).toHaveBeenCalledTimes(1);
        expect(mini.onMiniLeaveSoon).not.toHaveBeenCalled();

        fire(first, "mousemove");
        expect(mini.onMiniMove).toHaveBeenCalledTimes(1);

        fire(second, "mouseover");
        expect(mini.onMiniLeaveSoon).toHaveBeenCalledTimes(1);
        expect(mini.onMiniEnter).toHaveBeenLastCalledWith(second, expect.any(MouseEvent));

        fire(second, "mouseout", {relatedTarget: document.body});
        expect(mini.onMiniLeaveSoon).toHaveBeenCalledTimes(2);
        fire(document.body, "mousemove");
        expect(mini.onMiniMove).toHaveBeenCalledTimes(1);
    });

    it("창 밖으로 나가도 떠난 것이다", () => {
        renderList([{no: 1}]);
        const {mini} = start();
        fire(find(".ub-word"), "mouseover");
        fire(find(".ub-word"), "mouseout");
        expect(mini.onMiniLeaveSoon).toHaveBeenCalledTimes(1);
    });
});

it("멈추면 받지 않는다", () => {
    renderList([{no: 1}]);
    const {opened, mini} = start();
    stop();
    rightClick(find(".ub-word a"));
    fire(find(".ub-word"), "mouseover");
    expect(opened).toEqual([]);
    expect(mini.onMiniEnter).not.toHaveBeenCalled();
});
