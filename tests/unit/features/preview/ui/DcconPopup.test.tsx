import {render, act} from "@/tests/helpers";
import type {ReactNode} from "react";
import {afterEach, expect, it, vi} from "vitest";

import {fetchDcconList} from "@/core/preview/request";
import {DcconPopup} from "@/features/preview/ui/DcconPopup";

// 창과 토글을 평범한 요소로 바꾼다(native <dialog> 등은 jsdom에서 안 그려진다).
vi.mock("@/components/dialogs", () => ({
    ModalDialog: ({children}: { children?: ReactNode }) => <div>{children}</div>,
    DialogCloseButton: () => null,
    DialogTitle: () => null
}));
vi.mock("@/core/preview/request", () => ({fetchDcconList: vi.fn()}));

const root = document.createElement("div");
document.body.append(root);
afterEach(() => render(null, root));

/** 패키지 줄. 넓이를 정해 옆으로 넘치게 한다(jsdom은 크기가 0이다). */
const openStrip = async (): Promise<HTMLElement> => {
    vi.mocked(fetchDcconList).mockResolvedValue([{package_idx: "1", title: "콘", main_img_url: "", detail: []}]);
    await act(() => render(<DcconPopup onSelect={vi.fn()} onClose={vi.fn()}/>, root));
    await vi.waitFor(() => expect(root.querySelector(".overflow-x-auto button")).not.toBeNull());
    const strip = root.querySelector<HTMLElement>(".overflow-x-auto")!;
    // 굴린 곳은 scrollTo에 넘긴 left로 본다. jsdom은 굴리지 않는다.
    Object.defineProperties(strip, {scrollWidth: {value: 1000}, clientWidth: {value: 500}, scrollTo: {value: vi.fn()}});
    return strip;
};

const wheel = (el: Element, init: WheelEventInit): WheelEvent => {
    const ev = new WheelEvent("wheel", {bubbles: true, cancelable: true, ...init});
    el.dispatchEvent(ev);
    return ev;
};

const scrolledTo = (strip: HTMLElement, left: number): void => expect(strip.scrollTo).toHaveBeenLastCalledWith({left, behavior: "smooth"});

it("세로 휠로 패키지 줄을 옆으로 부드럽게 넘기고, 굴러가는 동안 이어진 휠은 굴러갈 곳에 더한다", async () => {
    const strip = await openStrip();
    const ev = wheel(strip, {deltaY: 100});
    expect(ev.defaultPrevented).toBe(true);
    scrolledTo(strip, 100);

    wheel(strip, {deltaY: 100});
    scrolledTo(strip, 200);
    wheel(strip, {deltaY: 1000});
    scrolledTo(strip, 500);

    strip.scrollLeft = 300;
    strip.dispatchEvent(new Event("scrollend"));
    wheel(strip, {deltaY: -100});
    scrolledTo(strip, 200);
});

it("Shift, Ctrl, 가로 휠은 브라우저에 맡긴다", async () => {
    const strip = await openStrip();
    for (const init of [{deltaY: 100, shiftKey: true}, {deltaY: 100, ctrlKey: true}, {deltaX: 100, deltaY: 10}]) {
        expect(wheel(strip, init).defaultPrevented).toBe(false);
    }
    expect(strip.scrollTo).not.toHaveBeenCalled();
});
