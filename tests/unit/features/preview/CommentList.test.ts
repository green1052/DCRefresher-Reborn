import {describe, expect, it} from "vitest";

import type {ProcessedComment} from "@/core/preview/comments";
import {threadParents} from "@/features/preview/ui/CommentList";

const comment = (no: number, fields: Partial<ProcessedComment> = {}): ProcessedComment => ({
    no: String(no), c_no: "0", depth: 0, user_id: "", name: "ㅇㅇ", ip: "", memo: `댓글 ${no}`, is_delete: "0", date_time: "", ...fields
});

// 번호(등록)순 목록: 1의 답글 2, 3, 부모를 받지 못한 답글 5 (부모 4는 10쪽 밖), 6.
const comments = [
    comment(1), comment(2, {c_no: "1", depth: 1}), comment(3, {c_no: "1", depth: 1}),
    comment(5, {c_no: "4", depth: 1}), comment(6)
];
const nos = (list: ProcessedComment[]) => list.map((item) => item.no);

describe("threadParents", () => {
    it("첫 댓글과 부모를 받지 못한 답글을 등록순으로 고른다", () => {
        expect(nos(threadParents(comments))).toEqual(["1", "5", "6"]);
    });

    it("최신순이면 스레드만 거꾸로 세우고 받은 목록은 건드리지 않는다", () => {
        expect(nos(threadParents(comments, true))).toEqual(["6", "5", "1"]);
        expect(nos(comments)).toEqual(["1", "2", "3", "5", "6"]);
    });
});
