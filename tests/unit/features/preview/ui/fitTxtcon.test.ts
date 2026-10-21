import {afterEach, expect, it, vi} from "vitest";

import {fitTxtconNearView} from "@/features/preview/ui/fitTxtcon";

// jsdom에는 IntersectionObserver가 없다. 만든 감시자와 감시 중인 칸을 기록한다.
const made: { root: Element | null; watching: Set<Element>; disconnected: boolean }[] = [];
vi.stubGlobal("IntersectionObserver", class {
    readonly record;

    constructor(_: IntersectionObserverCallback, {root}: IntersectionObserverInit) {
        this.record = {root: root instanceof Element ? root : null, watching: new Set<Element>(), disconnected: false};
        made.push(this.record);
    }

    get root(): Element | null {
        return this.record.root;
    }

    observe(el: Element): void {
        this.record.watching.add(el);
    }

    unobserve(el: Element): void {
        this.record.watching.delete(el);
    }

    disconnect(): void {
        this.record.disconnected = true;
        this.record.watching.clear();
    }
});

/** 미리보기 창(스크롤 칸)과 그 안의 글자콘 칸 n개. */
const frame = (n: number): HTMLElement[] => {
    const scroll = document.createElement("div");
    scroll.className = "refresher-frame-scroll";
    document.body.append(scroll);
    return Array.from({length: n}, () => scroll.appendChild(document.createElement("div")));
};

afterEach(() => {
    document.body.innerHTML = "";
    made.length = 0;
});

it("창의 글자콘 감시를 다 풀면(창을 닫으면) 감시자를 놓는다", () => {
    const stops = frame(2).map(fitTxtconNearView);
    expect(made).toHaveLength(1);
    expect(made[0]!.watching.size).toBe(2);

    stops[0]!();
    expect(made[0]!.disconnected).toBe(false);
    stops[1]!();
    expect(made[0]!.disconnected).toBe(true);

    // 다음 창은 새 감시자를 쓴다.
    frame(1).map(fitTxtconNearView);
    expect(made).toHaveLength(2);
});

it("새 창을 열면 앞 창 감시자를 끊고, 늦게 온 앞 창 정리는 새 감시자를 건드리지 않는다", () => {
    const [old] = frame(1).map(fitTxtconNearView);
    frame(1).map(fitTxtconNearView);
    expect(made[0]!.disconnected).toBe(true);

    old!();
    expect(made[1]!.disconnected).toBe(false);
    expect(made[1]!.watching.size).toBe(1);
});
