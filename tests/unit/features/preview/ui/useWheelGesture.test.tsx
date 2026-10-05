import {render} from "preact";
import {act} from "preact/test-utils";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {useWheelGesture} from "@/features/preview/ui/useWheelGesture";

let container: HTMLElement;
let hint = {dir: 0, key: ""};
const goTo = vi.fn<(dir: number) => void>();

const Box = ({postKey, enabled = true}: { postKey: string; enabled?: boolean }) => {
    const gesture = useWheelGesture(postKey, goTo, enabled);
    hint = gesture.hint;
    return <div id="box" onWheel={gesture.onWheel}><p id="text">글</p><div id="inner">입력칸</div></div>;
};

const mount = (postKey = "a", enabled = true) => act(() => render(<Box postKey={postKey} enabled={enabled}/>, container));

const element = (id: string): HTMLElement => {
    const found = document.getElementById(id);
    if (!found) throw new Error(`#${id}가 없다`);
    return found;
};

/** 스크롤 칸 크기. jsdom은 모두 0이라 늘 끝에 닿은 것으로 잰다. */
const scrollable = (target: HTMLElement, scrollTop: number, clientHeight = 100, scrollHeight = 300) => {
    Object.defineProperty(target, "scrollTop", {configurable: true, value: scrollTop});
    Object.defineProperty(target, "clientHeight", {configurable: true, value: clientHeight});
    Object.defineProperty(target, "scrollHeight", {configurable: true, value: scrollHeight});
};

/** timeStamp(ms)에 deltaY만큼 굴린다. */
const wheel = (timeStamp: number, deltaY: number, init: WheelEventInit = {}, target = element("text")) =>
    act(() => {
        const ev = new WheelEvent("wheel", {deltaY, bubbles: true, cancelable: true, ...init});
        Object.defineProperty(ev, "timeStamp", {value: timeStamp});
        target.dispatchEvent(ev);
    });

beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    hint = {dir: 0, key: ""};
});
afterEach(() => {
    render(null, container);
    container.remove();
});

describe("useWheelGesture", () => {
    it("끝에서 새로 굴리면 넘긴다", () => {
        mount();
        wheel(1000, 50);
        expect(goTo).not.toHaveBeenCalled();
        expect(hint).toEqual({dir: 1, key: "a"});
        wheel(1300, 50);
        expect(goTo).toHaveBeenCalledWith(1);
        expect(hint).toEqual({dir: 0, key: "a"});
    });

    it("끝에 닿은 그 동작으로는 넘기지 않는다", () => {
        mount();
        wheel(1000, 50);
        wheel(1100, 50);
        wheel(1200, 50);
        expect(goTo).not.toHaveBeenCalled();
    });

    it("넘긴 동작의 관성은 다음 글에서 무시한다", () => {
        mount("a");
        wheel(1000, -50);
        wheel(1500, -50);
        expect(goTo).toHaveBeenCalledWith(-1);
        mount("b");
        wheel(1600, -50);
        wheel(1700, -50);
        expect(hint.dir).toBe(0);
        // 새 동작은 다시 끝에 닿은 것으로 센다.
        wheel(2000, -50);
        expect(hint).toEqual({dir: -1, key: "b"});
        expect(goTo).toHaveBeenCalledTimes(1);
    });

    it("다른 방향이면 다시 기다린다", () => {
        mount();
        wheel(1000, 50);
        wheel(1500, -50);
        expect(goTo).not.toHaveBeenCalled();
        expect(hint.dir).toBe(-1);
    });

    it("글이 바뀌면 끝에 닿아 둔 것을 버린다", () => {
        mount("a");
        wheel(1000, 50);
        mount("b");
        wheel(1500, 50);
        expect(goTo).not.toHaveBeenCalled();
    });

    it("아직 굴러가면 끝이 아니다", () => {
        mount();
        scrollable(element("box"), 100);
        wheel(1000, 50);
        wheel(1500, 50);
        expect(goTo).not.toHaveBeenCalled();
        expect(hint.dir).toBe(0);
    });

    it("안쪽 스크롤 칸이 굴러가면 끝이 아니다", () => {
        mount();
        const inner = element("inner");
        inner.style.overflowY = "auto";
        scrollable(inner, 0);
        wheel(1000, 50, {}, inner);
        wheel(1500, 50, {}, inner);
        expect(goTo).not.toHaveBeenCalled();
    });

    it("꺼져 있거나 Ctrl·Shift면 무시한다", () => {
        mount("a", false);
        wheel(1000, 50);
        wheel(1500, 50);
        mount("a", true);
        wheel(2000, 50, {ctrlKey: true});
        wheel(2500, 50, {ctrlKey: true});
        wheel(3000, 50, {shiftKey: true});
        wheel(3500, 50, {shiftKey: true});
        wheel(4000, 0);
        expect(goTo).not.toHaveBeenCalled();
        expect(hint.dir).toBe(0);
    });
});
