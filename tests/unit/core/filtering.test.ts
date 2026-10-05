import {afterEach, describe, expect, it, vi} from "vitest";

import {addFilter} from "@/core/filtering";

import {tick} from "../../helpers";

const disposers: (() => void)[] = [];

const filter = (scope: string, callback: (element: HTMLElement) => void = () => {}): ((element: HTMLElement) => void) => {
    const spy = vi.fn(callback);
    disposers.push(addFilter(scope, spy));
    return spy;
};

const html = (markup: string): HTMLElement => {
    const wrap = document.createElement("div");
    wrap.innerHTML = markup;
    return wrap.querySelector<HTMLElement>(":scope > *")!;
};

const ids = (spy: (element: HTMLElement) => void): string[] => vi.mocked(spy).mock.calls.map(([element]) => element.id);

afterEach(() => {
    for (const dispose of disposers.splice(0)) dispose();
    document.body.innerHTML = "";
});

describe("addFilter", () => {
    it("지금 있는 요소는 바로, 나중에 붙은 요소는 붙을 때 부른다", async () => {
        document.body.innerHTML = "<div class='row' id='a'></div>";
        const spy = filter(".row");
        expect(ids(spy)).toEqual(["a"]);

        document.body.append(html("<div class='row' id='b'></div>"));
        await tick();
        expect(ids(spy)).toEqual(["a", "b"]);
    });

    it("붙은 덩어리 안의 요소도 부른다", async () => {
        const spy = filter(".row");
        document.body.append(html("<section><div class='row' id='a'><div class='row' id='b'></div></div></section>"));
        await tick();
        expect(ids(spy)).toEqual(["a", "b"]);
    });

    it("붙은 조상과 그 안에 따로 붙은 자손이 같은 묶음이면 한 번만 부른다", async () => {
        const spy = filter(".row");
        const parent = html("<div class='row' id='a'></div>");
        document.body.append(parent);
        parent.append(html("<div class='row' id='b'></div>"));
        await tick();
        expect(ids(spy)).toEqual(["a", "b"]);
    });

    it("자식이 붙어 조건을 새로 만족한 조상도 부른다", async () => {
        document.body.innerHTML = "<div class='row' id='a'></div>";
        const spy = filter(".row:has(.badge)");
        expect(spy).not.toHaveBeenCalled();

        document.querySelector("#a")!.append(html("<span class='badge'></span>"));
        await tick();
        expect(ids(spy)).toEqual(["a"]);
    });

    it("유저 정보 배지 묶음이 붙은 것은 보지 않는다", async () => {
        document.body.innerHTML = "<div class='ub-writer' id='w'></div>";
        const spy = filter(".ub-writer");
        document.querySelector("#w")!.append(html("<span class='refresher-user-badges'></span>"));
        await tick();
        expect(ids(spy)).toEqual(["w"]);
    });

    it("붙었다가 같은 묶음에서 빠진 요소는 부르지 않는다", async () => {
        const spy = filter(".row");
        const row = html("<div class='row' id='a'></div>");
        document.body.append(row);
        row.remove();
        await tick();
        expect(spy).not.toHaveBeenCalled();
    });

    it("콜백이 던져도 다른 요소와 필터는 계속 돈다", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const failing = filter(".row", (element) => {
            if (element.id === "a") throw new Error("실패");
        });
        const other = filter(".row");
        document.body.append(html("<div class='row' id='a'></div>"), html("<div class='row' id='b'></div>"));
        await tick();
        expect(ids(failing)).toEqual(["a", "b"]);
        expect(ids(other)).toEqual(["a", "b"]);
        expect(console.error).toHaveBeenCalledOnce();
    });

    it("해제하면 더 부르지 않고 다른 필터는 남는다", async () => {
        const first = vi.fn();
        const dispose = addFilter(".row", first);
        const second = filter(".row");
        dispose();

        document.body.append(html("<div class='row' id='a'></div>"));
        await tick();
        expect(first).not.toHaveBeenCalled();
        expect(ids(second)).toEqual(["a"]);
    });

    it("모두 해제한 뒤 다시 걸어도 감시한다", async () => {
        addFilter(".row", () => {})();
        const spy = filter(".row");
        document.body.append(html("<div class='row' id='a'></div>"));
        await tick();
        expect(ids(spy)).toEqual(["a"]);
    });

    it("틀린 선택자는 던지고 등록하지 않는다", async () => {
        expect(() => addFilter("[", () => {})).toThrow();
        // 등록됐다면 합친 선택자가 틀려 다른 필터까지 깨진다.
        const spy = filter(".row");
        document.body.append(html("<div class='row' id='a'></div>"));
        await tick();
        expect(ids(spy)).toEqual(["a"]);
    });
});
