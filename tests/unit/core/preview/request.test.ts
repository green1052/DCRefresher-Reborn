import {describe, expect, it, vi} from "vitest";

import {ajax} from "@/core/http/client";
import {fetchComments} from "@/core/preview/request";
import type {DcinsideComment, GalleryPreData} from "@/core/preview/types";

const preData = (commentCount: number): GalleryPreData => ({
    gallery: "test", id: "1", link: "https://gall.dcinside.com/board/view/?id=test&no=1", notice: false, recommend: false, type: "icon_txt", commentCount
});

const comment = (no: number): DcinsideComment => ({no: String(no), c_no: String(no), depth: 0, name: "ㅇㅇ", memo: "", is_delete: "0"}) as DcinsideComment;

/** 쪽마다 댓글 응답을 돌려주는 가짜 ajax.post. 받은 쪽 번호를 모은다. */
const mockPages = (lastPage: number, commentsOf: (page: number) => DcinsideComment[]) => {
    const requested: number[] = [];
    vi.spyOn(ajax, "post").mockImplementation(((_url: string, options?: { body?: URLSearchParams }) => {
        const page = Number(options?.body?.get("comment_page"));
        requested.push(page);
        const response = {
            comments: commentsOf(page),
            total_cnt: 0,
            pagination: Array.from({length: lastPage}, (_, index) => `<a href="javascript:viewComments(${index + 1}, 'D')">${index + 1}</a>`).join(""),
            allow_reply: 1
        };
        return {json: async () => response};
    }) as never);
    return requested;
};

describe("fetchComments", () => {
    it("목록의 댓글 수로 쪽을 어림해 같이 받고, 쪽 나눔을 보고 남은 쪽을 마저 받는다. 겹친 댓글은 하나로 번호순이다", async () => {
        // 250개 → 3쪽을 어림했지만 실제로는 5쪽이다. 쪽 사이에 댓글 하나(50)가 겹쳐 온다.
        const requested = mockPages(5, (page) => [comment(page * 10), comment(50)]);
        const result = await fetchComments(preData(250), {esno: "token"}, new AbortController().signal);

        expect(requested.toSorted((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
        expect(result.list.map((item) => item.no)).toEqual(["10", "20", "30", "40", "50"]);
        expect(result.truncated).toBe(false);
        expect(result.allowReply).toBe(true);
    });

    it("10쪽까지만 받고 잘렸다고 알린다", async () => {
        const requested = mockPages(12, (page) => [comment(page)]);
        const result = await fetchComments(preData(0), {esno: "token"}, new AbortController().signal);

        expect(requested.toSorted((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        expect(result.truncated).toBe(true);
    });
});
