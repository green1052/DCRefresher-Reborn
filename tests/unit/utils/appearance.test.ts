import {describe, expect, it} from "vitest";

import {setDarkAppearance} from "@/utils/appearance";

describe("setDarkAppearance", () => {
    it("테마(forest)는 항상 어두워서 루트에 dark와 color-scheme을 항상 준다", () => {
        const root = document.createElement("div");
        setDarkAppearance(root);
        expect(root.classList.contains("dark")).toBe(true);
        expect(root.style.colorScheme).toBe("dark");
    });
});
