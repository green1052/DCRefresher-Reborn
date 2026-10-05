import {describe, expect, it} from "vitest";

import {getEntry, postKey, restoreArchive, setEntry} from "@/core/preview/cache";
import type {DcinsideComment} from "@/core/preview/types";

import {testPreData} from "../../../helpers";

const comment = (no: string, cNo = ""): DcinsideComment => ({no, c_no: cNo, depth: 0, user_id: "", name: "", ip: "", memo: "", is_delete: "0", date_time: ""});

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

describe("restoreArchive", () => {
    it("잘렸다는 이유만으로 빈 목록을 받으면 지금까지 본 댓글을 모두 삭제로 되살린다", () => {
        const preData = testPreData();
        restoreArchive(preData, [comment("1"), comment("2")]);

        // 서버가 빈 목록을 줬다 (Min이 Infinity가 되어 되살리지 않던 경우).
        const restored = restoreArchive(preData, [], true);
        expect(restored.map(({no, is_delete}) => [no, is_delete])).toEqual([["1", "1"], ["2", "1"]]);
    });
});
