import {beforeEach, describe, expect, it} from "vitest";

import {markBlockedDccons} from "@/features/preview/ui/blockedDccons";

import {setBlockLists} from "../../../../helpers";

const render = (): HTMLElement => {
    const root = document.createElement("div");
    root.innerHTML = `
        <img class="written_dccon" data-n="a" src="https://dcimg5.dcinside.com/dccon.php?no=aa">
        <video class="written_dccon" data-n="b" data-src="https://dcimg5.dcinside.com/dccon.php?no=bb"></video>
        <span class="written_dccon" data-n="c"><img src="https://dcimg5.dcinside.com/dccon.php?no=cc"></span>
        <span class="written_dccon" data-n="d"></span>`;
    return root;
};

const marks = (root: HTMLElement) => Object.fromEntries(Array.from(root.querySelectorAll<HTMLElement>(".written_dccon"), (dccon) => [dccon.dataset.n, dccon.dataset.blocked ?? null]));

beforeEach(() => setBlockLists({DCCON: [{id: "1", content: "bb", isRegex: false}, {id: "2", content: "cc", isRegex: false, gallery: "g"}]}));

describe("markBlockedDccons", () => {
    it("차단 디시콘에 가리는 방식을 단다", () => {
        const root = render();
        markBlockedDccons(root, "g", "blur");
        expect(marks(root)).toEqual({a: null, b: "blur", c: "blur", d: null});
    });

    it("갤러리 한정 차단은 그 갤러리에서만 단다", () => {
        const root = render();
        markBlockedDccons(root, "other", "hide");
        expect(marks(root)).toEqual({a: null, b: "hide", c: null, d: null});
    });

    it("차단 모듈이 꺼지거나 목록에서 빠지면 뗀다", () => {
        const root = render();
        markBlockedDccons(root, "g", "hide");
        markBlockedDccons(root, "g", undefined);
        expect(marks(root)).toEqual({a: null, b: null, c: null, d: null});
        markBlockedDccons(root, "g", "hide");
        setBlockLists();
        markBlockedDccons(root, "g", "hide");
        expect(marks(root)).toEqual({a: null, b: null, c: null, d: null});
    });
});
