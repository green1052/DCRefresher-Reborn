import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {addFilter} from "@/core/filtering";

import {tick} from "../../helpers";


let removers: (() => void)[] = [];
const watch = (scope: string) => {
    const seen: HTMLElement[] = [];
    removers.push(addFilter(scope, (element) => seen.push(element)));
    return seen;
};

beforeEach(() => {
    document.body.innerHTML = "<table class=\"gall_list\"><tbody></tbody></table>";
});

afterEach(() => {
    for (const remove of removers) remove();
    removers = [];
});

describe("addFilter", () => {
    it("지금 있는 요소는 바로, 나중에 붙은 요소는 붙을 때 부른다", async () => {
        document.querySelector("tbody")!.innerHTML = "<tr class=\"row\" id=\"a\"></tr>";
        const seen = watch(".row");
        expect(seen.map((element) => element.id)).toEqual(["a"]);

        document.querySelector("tbody")!.insertAdjacentHTML("beforeend", "<tr class=\"row\" id=\"b\"></tr>");
        await tick();
        expect(seen.map((element) => element.id)).toEqual(["a", "b"]);
    });

    it("함께 붙은 조상 안의 요소는 한 번만 부른다", async () => {
        const seen = watch(".row");
        const table = document.createElement("table");
        table.innerHTML = "<tbody><tr class=\"row\"></tr><tr class=\"row\"></tr></tbody>";
        document.body.append(table);
        // 조상이 붙은 뒤 같은 묶음에서 그 안에 또 붙인 행도 한 번만 잡힌다.
        table.querySelector("tbody")!.append(Object.assign(document.createElement("tr"), {className: "row"}));
        await tick();
        expect(seen).toHaveLength(3);
        expect(new Set(seen).size).toBe(3);
    });

    it("자식이 붙어 조건을 새로 만족한 조상도 부른다 (closest)", async () => {
        const seen = watch(".gall_list tr");
        const row = document.createElement("tr");
        document.querySelector("tbody")!.append(row);
        await tick();
        seen.length = 0;

        row.append(document.createElement("td"));
        await tick();
        expect(seen).toEqual([row]);
    });

    it("유저 정보 배지 묶음이 붙은 것은 보지 않는다", async () => {
        const writer = Object.assign(document.createElement("td"), {className: "ub-writer"});
        document.querySelector("tbody")!.append(document.createElement("tr"));
        document.querySelector("tr")!.append(writer);
        const seen = watch(".ub-writer");
        seen.length = 0;

        writer.append(Object.assign(document.createElement("span"), {className: "refresher-user-badges"}));
        await tick();
        expect(seen).toEqual([]);
    });

    it("콜백이 던져도 다른 요소와 필터는 계속 돈다", async () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
        removers.push(addFilter(".row", (element) => {
            if (element.id === "bad") throw new Error("x");
        }));
        const seen = watch(".row");
        document.querySelector("tbody")!.insertAdjacentHTML("beforeend", "<tr class=\"row\" id=\"bad\"></tr><tr class=\"row\" id=\"ok\"></tr>");
        await tick();
        expect(seen.map((element) => element.id)).toEqual(["bad", "ok"]);
        expect(error).toHaveBeenCalledOnce();
    });
});
