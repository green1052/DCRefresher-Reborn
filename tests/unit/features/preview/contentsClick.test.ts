import {describe, expect, it} from "vitest";

import {markPressable} from "@/features/preview/ui/contentsClick";

describe("markPressable", () => {
    it("alt가 있으면 이름에 남기고, 없으면 할 일만 읽는다", () => {
        const root = document.createElement("div");
        root.innerHTML = "<img class=\"written_dccon\" alt=\"웃음\"><img class=\"written_dccon\" alt=\" \"><img alt=\"고양이\"><img>";
        markPressable(root, true);

        expect([...root.querySelectorAll("img")].map((image) => image.getAttribute("aria-label")))
            .toEqual(["웃음 (디시콘 정보)", "디시콘 정보", "고양이 (이미지 크게 보기)", "이미지 크게 보기"]);
    });
});
