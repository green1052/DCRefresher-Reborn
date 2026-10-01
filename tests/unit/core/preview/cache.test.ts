import {describe, expect, it} from "vitest";

import {postKey} from "@/core/preview/cache";

describe("postKey", () => {
    it("갤러리 종류가 다르면 id와 번호가 같아도 다른 글이다", () => {
        const normal = postKey({gallery: "game", id: "1", link: "https://gall.dcinside.com/board/view/?id=game&no=1"});
        const minor = postKey({gallery: "game", id: "1", link: "https://gall.dcinside.com/mgallery/board/view/?id=game&no=1"});
        const mini = postKey({gallery: "game", id: "1", link: "https://gall.dcinside.com/mini/board/view/?id=game&no=1"});
        expect(normal).toBe("game:1");
        expect(minor).toBe("minor/game:1");
        expect(new Set([normal, minor, mini]).size).toBe(3);
    });
});
