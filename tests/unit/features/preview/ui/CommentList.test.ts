import {describe, expect, it} from "vitest";

import type {ProcessedComment} from "@/core/preview/comments";
import {threadParents} from "@/features/preview/ui/CommentList";

const comment = (no: number, cNo = 0): ProcessedComment => ({
    no: String(no), c_no: String(cNo), depth: cNo ? 1 : 0, user_id: "", name: "", ip: "", memo: "", is_delete: "0", date_time: ""
});

describe("threadParents", () => {
    it("첫 댓글만 스레드 머리로 쓴다", () => {
        expect(threadParents([comment(1), comment(2, 1), comment(3), comment(4, 3)]).map((item) => item.no)).toEqual(["1", "3"]);
    });

    it("부모를 받지 못한 답글도 머리로 넣는다", () => {
        // 10쪽 제한으로 부모(1)가 빠졌다.
        expect(threadParents([comment(2, 1), comment(3), comment(4, 3)]).map((item) => item.no)).toEqual(["2", "3"]);
    });
});
