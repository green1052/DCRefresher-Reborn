/**
 * @vitest-environment-options {"url": "https://gall.dcinside.com/board/lists/?id=test"}
 */
import {afterEach, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";

import type {GalleryPreData} from "@/core/preview/types";
import {bindListKeys} from "@/features/preview/keyboard";
import {usePreviewStore} from "@/features/preview/ui/previewStore";
import {useUiStore} from "@/stores/ui";

import {preData, tick} from "../../../helpers";
import {fakeCtx} from "./ctx";
import {postHref, renderList} from "./list";

// jsdom에는 없다.
beforeAll(() => {
    Object.defineProperty(Element.prototype, "scrollIntoView", {configurable: true, value: () => undefined});
});

const initialPreview = usePreviewStore.getState();
let stop = (): void => undefined;
beforeEach(() => {
    vi.stubGlobal("matchMedia", () => ({matches: false}));
    usePreviewStore.setState(initialPreview, true);
    useUiStore.setState({blockView: null});
});
afterEach(() => {
    stop();
    vi.unstubAllGlobals();
});

const start = (settings: Parameters<typeof fakeCtx>[0] = {}) => {
    const fake = fakeCtx(settings);
    stop = fake.stop;
    const opened: GalleryPreData[] = [];
    bindListKeys(fake.ctx, (pre) => opened.push(pre));
    return {opened, ...fake};
};

const press = (code: string, init: KeyboardEventInit = {}, target: EventTarget = document.body): KeyboardEvent => {
    const ev = new KeyboardEvent("keydown", {code, bubbles: true, cancelable: true, ...init});
    target.dispatchEvent(ev);
    return ev;
};

const selected = () => Array.from(document.querySelectorAll<HTMLElement>(".refresherSelected"), (row) => Number(row.dataset.no));

describe("bindListKeys", () => {
    it("J·K로 고르고 끝에서 멈춘다", () => {
        renderList([{no: 1}, {no: 2}, {no: 3}]);
        start();
        expect(press("KeyJ").defaultPrevented).toBe(true);
        expect(selected()).toEqual([1]);
        press("KeyJ");
        press("KeyJ");
        press("KeyJ");
        expect(selected()).toEqual([3]);
        press("KeyK");
        expect(selected()).toEqual([2]);
        press("KeyK");
        press("KeyK");
        expect(selected()).toEqual([1]);
    });

    it("한글 입력 상태여도 위치로 받는다", () => {
        renderList([{no: 1}]);
        start();
        press("KeyJ", {key: "ㅓ"});
        expect(selected()).toEqual([1]);
    });

    it("숨긴 행과 블러 행을 건너뛴다", () => {
        renderList([{no: 1}, {no: 2, className: "refresherBlur"}, {no: 3, hidden: true}, {no: 4}]);
        useUiStore.setState({blockView: {blur: true, blurReveal: false, replyRemove: false, revealed: false, duplicate: null}});
        start();
        press("KeyJ");
        press("KeyJ");
        expect(selected()).toEqual([4]);
    });

    it("Enter로 고른 글을 연다", () => {
        renderList([{no: 1}, {no: 2}]);
        const {opened} = start();
        press("KeyJ");
        press("KeyJ");
        expect(press("NumpadEnter").defaultPrevented).toBe(true);
        expect(opened.map((pre) => pre.id)).toEqual(["2"]);
    });

    it("고른 글이 없거나 누르고 있으면 열지 않는다", () => {
        renderList([{no: 1}]);
        const {opened} = start();
        expect(press("Enter").defaultPrevented).toBe(false);
        press("KeyJ");
        press("Enter", {repeat: true});
        expect(opened).toEqual([]);
    });

    it("링크에 포커스가 있으면 Enter는 링크 몫이다", () => {
        renderList([{no: 1}]);
        const {opened} = start();
        press("KeyJ");
        const link = document.querySelector("a");
        link?.focus();
        expect(press("Enter").defaultPrevented).toBe(false);
        expect(opened).toEqual([]);
    });

    it("Esc로 선택을 푼다", () => {
        renderList([{no: 1}]);
        start();
        expect(press("Escape").defaultPrevented).toBe(false);
        press("KeyJ");
        expect(press("Escape").defaultPrevented).toBe(true);
        expect(selected()).toEqual([]);
    });

    it("받지 않을 때가 있다", () => {
        renderList([{no: 1}]);
        const {settings} = start({listKeyboard: false});
        press("KeyJ");
        expect(selected()).toEqual([]);
        settings.listKeyboard = true;
        press("KeyJ", {ctrlKey: true});
        press("KeyJ", {altKey: true});
        press("KeyJ", {metaKey: true});
        expect(selected()).toEqual([]);
        // 다른 창이 이미 쓴 키.
        const used = new KeyboardEvent("keydown", {code: "KeyJ", bubbles: true, cancelable: true});
        used.preventDefault();
        document.body.dispatchEvent(used);
        expect(selected()).toEqual([]);
    });

    it("입력 중이면 받지 않는다", () => {
        renderList([{no: 1}]);
        start();
        const input = document.createElement("input");
        document.body.append(input);
        press("KeyJ", {}, input);
        expect(selected()).toEqual([]);
    });

    it("미리보기가 열려 있으면 받지 않는다", () => {
        renderList([{no: 1}]);
        start();
        usePreviewStore.setState({visible: true});
        press("KeyJ");
        expect(selected()).toEqual([]);
    });

    it("새로고침으로 바뀐 행에도 표시한다", async () => {
        renderList([{no: 1}, {no: 2}]);
        start();
        press("KeyJ");
        press("KeyJ");
        renderList([{no: 3}, {no: 2}]);
        await tick();
        expect(selected()).toEqual([2]);
    });

    it("미리보기를 닫으면 마지막으로 본 글을 고른다", () => {
        renderList([{no: 1}, {no: 2}, {no: 3}]);
        start();
        press("KeyJ");
        usePreviewStore.getState().open(preData({id: "3", link: postHref(3)}));
        usePreviewStore.getState().close();
        expect(selected()).toEqual([3]);
    });

    it("키보드로 고르던 중이 아니면 고르지 않는다", () => {
        renderList([{no: 1}, {no: 2}]);
        start();
        usePreviewStore.getState().open(preData({id: "2", link: postHref(2)}));
        usePreviewStore.getState().close();
        expect(selected()).toEqual([]);
    });

    it("멈추면 선택을 푼다", () => {
        renderList([{no: 1}]);
        start();
        press("KeyJ");
        stop();
        expect(selected()).toEqual([]);
        press("KeyJ");
        expect(selected()).toEqual([]);
    });
});
