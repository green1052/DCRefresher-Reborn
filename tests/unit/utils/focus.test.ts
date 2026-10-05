import {expect, it} from "vitest";

import {focusOnMount} from "@/utils/focus";

it("붙은 요소에 포커스하고 null은 넘긴다", () => {
    const input = document.body.appendChild(document.createElement("input"));
    focusOnMount(input);
    expect(document.activeElement).toBe(input);
    expect(() => focusOnMount(null)).not.toThrow();
    input.remove();
});
