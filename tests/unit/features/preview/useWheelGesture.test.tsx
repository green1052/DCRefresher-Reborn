import {render} from "preact";
import {act} from "preact/test-utils";
import {afterEach, expect, it, vi} from "vitest";

import {useWheelGesture} from "@/features/preview/ui/useWheelGesture";

/** 스크롤 칸 하나에 훅을 단다. 지금 안내 방향을 data-hint에 적는다. jsdom은 크기가 0이라 칸은 늘 끝에 닿아 있다. */
const Box = ({goToAdjacent, canGo}: { goToAdjacent: (dir: number) => void; canGo: (dir: number) => boolean }) => {
    const {onWheel, hint} = useWheelGesture("post", goToAdjacent, canGo, true);
    return <div onWheel={onWheel} data-hint={hint.dir}/>;
};

/** timeStamp 시각에 아래(1)/위(-1)로 한 번 굴린다. */
const wheel = (box: Element, dir: number, timeStamp: number): void => {
    const ev = new WheelEvent("wheel", {deltaY: dir * 100, bubbles: true});
    Object.defineProperty(ev, "timeStamp", {value: timeStamp});
    act(() => void box.dispatchEvent(ev));
};

afterEach(() => {
    render(null, document.body);
});

it("끝에서 새로 한 번 더 굴리면 옆 글로 넘어간다", () => {
    const goToAdjacent = vi.fn();
    act(() => render(<Box goToAdjacent={goToAdjacent} canGo={() => true}/>, document.body));
    const box = document.body.firstElementChild!;

    wheel(box, 1, 1000);
    expect(box.getAttribute("data-hint")).toBe("1");
    expect(goToAdjacent).not.toHaveBeenCalled();

    wheel(box, 1, 2000);
    expect(goToAdjacent).toHaveBeenCalledWith(1);
});

it("그 방향에 넘어갈 글이 없으면(목록 처음·끝) 안내하지 않는다", () => {
    const goToAdjacent = vi.fn();
    act(() => render(<Box goToAdjacent={goToAdjacent} canGo={(dir) => dir > 0}/>, document.body));
    const box = document.body.firstElementChild!;

    wheel(box, -1, 1000);
    wheel(box, -1, 2000);
    expect(box.getAttribute("data-hint")).toBe("0");
    expect(goToAdjacent).not.toHaveBeenCalled();
});
