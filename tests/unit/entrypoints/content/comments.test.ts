import {describe, expect, it} from "vitest";

import {commentsFailedToRender} from "@/entrypoints/content/comments";

/** 본문 이미지 댓글. 글 댓글 칸보다 먼저 나온다. */
const IMAGE_COMMENT = `<div class="write_div"><div class="view_comment image_comment"><div class="comment_wrap show"><div class="comment_box"></div></div></div></div>`;

const viewComment = (total: string, list = ""): HTMLElement => {
    const root = document.createElement("div");
    root.innerHTML = `${IMAGE_COMMENT}<div class="view_comment"><div id="comment_wrap_1" class="comment_wrap">
        <div class="comment_count"><span id="comment_total_1">${total}</span></div>${list}</div></div>`;
    return root;
};

describe("commentsFailedToRender", () => {
    it("댓글 수는 적혔는데 목록이 없으면 그리다 실패한 것이다", () => {
        expect(commentsFailedToRender(viewComment("290"))).toBe(true);
        expect(commentsFailedToRender(viewComment("1,290"))).toBe(true);
    });

    it("목록이 있거나 댓글이 없거나(응답 전 포함) 댓글 칸이 없으면 아니다", () => {
        expect(commentsFailedToRender(viewComment("290", `<div class="comment_box"><ul class="cmt_list"></ul></div>`))).toBe(false);
        expect(commentsFailedToRender(viewComment("0"))).toBe(false);
        expect(commentsFailedToRender(document.createElement("div"))).toBe(false);
    });
});
