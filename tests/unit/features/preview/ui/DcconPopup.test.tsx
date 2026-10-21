import {render} from "preact";
import {act} from "preact/test-utils";
import type {ReactNode} from "react";
import {afterEach, expect, it, vi} from "vitest";

import {fetchDcconList} from "@/core/preview/request";
import {DcconPopup} from "@/features/preview/ui/DcconPopup";

// Base UI는 변환되지 않아 진짜 React를 불러 그려지지 않으므로 창·토글을 평범한 요소로 바꾼다.
vi.mock("@/components/dialogs", () => ({
    ModalDialog: ({children}: { children?: ReactNode }) => <div>{children}</div>,
    DialogCloseButton: () => null
}));
vi.mock("@/components/ui/button", () => ({Button: () => null}));
vi.mock("@/components/ui/dialog", () => ({DialogTitle: () => null}));
vi.mock("@/components/ui/field", () => ({Field: () => null, FieldLabel: () => null}));
vi.mock("@/components/ui/skeleton", () => ({Skeleton: () => null}));
vi.mock("@/components/ui/switch", () => ({Switch: () => null}));
vi.mock("@/components/ui/toggle-group", () => ({
    ToggleGroup: ({children}: { children?: ReactNode }) => <div>{children}</div>,
    ToggleGroupItem: () => <button className="pack"/>
}));
vi.mock("@/core/preview/request", () => ({fetchDcconList: vi.fn()}));

const root = document.createElement("div");
document.body.append(root);
afterEach(() => render(null, root));

/** 패키지 줄. 넓이를 정해 옆으로 넘치게 한다(jsdom은 크기가 0이다). */
const openStrip = async (): Promise<HTMLElement> => {
    vi.mocked(fetchDcconList).mockResolvedValue([{package_idx: "1", title: "콘", main_img_url: "", detail: []}]);
    await act(() => render(<DcconPopup onSelect={vi.fn()} onClose={vi.fn()}/>, root));
    await vi.waitFor(() => expect(root.querySelector(".pack")).not.toBeNull());
    const strip = root.querySelector<HTMLElement>(".overflow-x-auto")!;
    Object.defineProperties(strip, {scrollWidth: {value: 1000}, clientWidth: {value: 500}});
    return strip;
};

const wheel = (el: Element, init: WheelEventInit): WheelEvent => {
    const ev = new WheelEvent("wheel", {bubbles: true, cancelable: true, ...init});
    el.dispatchEvent(ev);
    return ev;
};

it("세로 휠로 패키지 줄을 옆으로 넘긴다", async () => {
    const strip = await openStrip();
    const ev = wheel(strip, {deltaY: 100});
    expect(strip.scrollLeft).toBe(100);
    expect(ev.defaultPrevented).toBe(true);
});

it("Shift·Ctrl·가로 휠은 브라우저에 맡긴다", async () => {
    const strip = await openStrip();
    for (const init of [{deltaY: 100, shiftKey: true}, {deltaY: 100, ctrlKey: true}, {deltaX: 100, deltaY: 10}]) {
        expect(wheel(strip, init).defaultPrevented).toBe(false);
    }
    expect(strip.scrollLeft).toBe(0);
});
