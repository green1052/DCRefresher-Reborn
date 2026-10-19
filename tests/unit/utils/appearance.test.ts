import {afterEach, describe, expect, it} from "vitest";

import {followDcAppearance} from "@/utils/appearance";

describe("followDcAppearance", () => {
    let stop = (): void => undefined;
    afterEach(() => {
        stop();
        document.getElementById("css-darkmode")?.remove();
    });

    it("글쓰기 페이지처럼 body에 붙였다 뗀 다크모드 링크도 따라간다", async () => {
        const root = document.createElement("div");
        stop = followDcAppearance(root);
        expect(root.classList.contains("dark")).toBe(false);

        const link = Object.assign(document.createElement("link"), {id: "css-darkmode", rel: "stylesheet"});
        document.body.append(link);
        await Promise.resolve();
        expect(root.classList.contains("dark")).toBe(true);

        link.remove();
        await Promise.resolve();
        expect(root.classList.contains("dark")).toBe(false);
    });
});
