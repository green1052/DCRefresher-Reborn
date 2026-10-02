import {describe, expect, it} from "vitest";

import {getEntry, postKey, setEntry} from "@/core/preview/cache";

import {testPreData} from "../../../helpers";

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

describe("setEntry", () => {
    it("기존 항목을 갈지 않고 준 필드만 덮어쓴다", () => {
        const preData = testPreData();
        setEntry(preData, {fetchedAt: 1});
        setEntry(preData, {comments: {list: [], allowReply: true}});
        expect(getEntry(preData)).toEqual({fetchedAt: 1, comments: {list: [], allowReply: true}});
    });
});
