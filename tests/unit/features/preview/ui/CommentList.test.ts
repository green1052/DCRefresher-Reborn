import {describe, expect, it} from "vitest";

import type {ProcessedComment} from "@/core/preview/comments";
import {summaryOf, threadParents} from "@/features/preview/ui/CommentList";

import {dcComment as comment} from "../../../../helpers";


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

describe("summaryOf", () => {
    it("가린 댓글이 없으면 개수만 적는다", () => {
        expect(summaryOf(comments)).toEqual({counts: "스레드 3개, 총 댓글 5개", hidden: ""});
    });

    it("차단과 접은 같은 댓글을 0이 아닌 것만 센다", () => {
        const hidden = [comment(1, {blocked: "hide"}), comment(2, {blocked: "blur"}), comment(3, {duplicates: 2}), comment(4, {duplicates: 0})];
        expect(summaryOf(hidden).hidden).toBe("차단 2개, 같은 댓글 1개 접음");
        expect(summaryOf(hidden.slice(2)).hidden).toBe("같은 댓글 1개 접음");
    });

    it("깡계로 가린 댓글은 차단과 따로 센다", () => {
        const hidden = [comment(1, {blocked: "hide"}), comment(2, {blocked: "hide", lowActivity: true}), comment(3, {blocked: "blur", lowActivity: true})];
        expect(summaryOf(hidden).hidden).toBe("차단 1개, 깡계 2개");
    });
});
