import {HTTPError} from "ky";
import {afterEach, describe, expect, it, vi} from "vitest";

const fetchMock = vi.hoisted(() => (globalThis.fetch = vi.fn<typeof fetch>()));

import {BlockedError} from "@/core/http/client";
import {urls} from "@/core/http/urls";
import {adminDeleteComments, blockCommenters, fetchComments, fetchPost, viewUrl, vote} from "@/core/preview/request";
import type {DcinsideComment, PostInfo} from "@/core/preview/types";

import {preData} from "../../../helpers";
import {serve} from "./net";

afterEach(() => void vi.unstubAllGlobals());

const signal = () => new AbortController().signal;

const comment = (no: number): DcinsideComment => ({no: String(no), c_no: "0", depth: 0, user_id: "", name: "ㅇㅇ", ip: "", memo: "", is_delete: "0", date_time: ""});

const pagination = (last: number) => Array.from({length: last}, (_, index) => `<a href="javascript:viewComments(${index + 1}, 'D')">${index + 1}</a>`).join("");

/** 쪽마다 댓글 응답. 요청한 쪽 번호를 모은다. */
const serveComments = (last: number, commentsOf: (page: number) => DcinsideComment[], extra: Record<string, unknown> = {}) => {
    const sent = serve(fetchMock, ({body}) => {
        const page = Number(body.get("comment_page"));
        return JSON.stringify({comments: commentsOf(page), total_cnt: 0, pagination: pagination(last), allow_reply: 1, ...extra});
    });
    return () => sent.map(({body}) => Number(body.get("comment_page"))).toSorted((a, b) => a - b);
};

const post = (fields: Partial<PostInfo> = {}): PostInfo => ({commentForm: {fields: [], serviceCode: "", checks: {}}, ...fields});

describe("viewUrl", () => {
    it("갤러리 종류의 글 주소를 만든다", () => {
        expect(viewUrl("https://gall.dcinside.com/mgallery/board/lists?id=a", "a", "3")).toBe("https://gall.dcinside.com/mgallery/board/view/?id=a&no=3");
        expect(viewUrl("https://gall.dcinside.com/board/lists?id=a", "a", "3")).toBe("https://gall.dcinside.com/board/view/?id=a&no=3");
    });
});

describe("fetchPost", () => {
    it("글 페이지를 받아 푼다", async () => {
        const sent = serve(fetchMock, () => "<div class=\"gallview_head\"><span class=\"title_subject\">제목</span></div>");
        const info = await fetchPost(preData({gallery: "a", id: "3", link: "https://gall.dcinside.com/mini/board/lists?id=a"}), signal());
        expect(info.title).toBe("제목");
        expect(sent.map(({url, method}) => [method, url])).toEqual([["GET", "https://gall.dcinside.com/mini/board/view/?id=a&no=3"]]);
    });

    it("글이 아닌 페이지면 던진다", async () => {
        serve(fetchMock, () => "<html><body><p>오류</p></body></html>");
        await expect(fetchPost(preData(), signal())).rejects.toThrow("게시글 페이지가 아닙니다.");
    });

    it("삭제된 글(404)은 HTTPError다", async () => {
        serve(fetchMock, () => new Response("", {status: 404}));
        await expect(fetchPost(preData(), signal())).rejects.toBeInstanceOf(HTTPError);
    });

    it("빈 페이지는 임시 차단이다", async () => {
        serve(fetchMock, () => "<html><head></head><body> </body></html>");
        await expect(fetchPost(preData(), signal())).rejects.toBeInstanceOf(BlockedError);
    });
});

describe("fetchComments", () => {
    it("어림한 쪽을 같이 받고 남은 쪽을 마저 받는다", async () => {
        // 250개라 3쪽을 어림했지만 실제로는 5쪽이다.
        const pages = serveComments(5, (page) => [comment(page * 10)]);
        const result = await fetchComments(preData({commentCount: 250}), {}, signal());
        expect(pages()).toEqual([1, 2, 3, 4, 5]);
        expect(result.list.map((item) => item.no)).toEqual(["10", "20", "30", "40", "50"]);
        expect(result.truncated).toBe(false);
    });

    it("쪽 사이에 겹친 댓글은 하나만 번호순으로 남긴다", async () => {
        serveComments(2, (page) => (page === 1 ? [comment(30), comment(20)] : [comment(20), comment(5)]));
        const result = await fetchComments(preData({commentCount: 150}), {}, signal());
        expect(result.list.map((item) => item.no)).toEqual(["5", "20", "30"]);
    });

    it("어림이 많아도 그 쪽만 받는다", async () => {
        const pages = serveComments(1, (page) => (page === 1 ? [comment(1)] : []));
        const result = await fetchComments(preData({commentCount: 250}), {}, signal());
        expect(pages()).toEqual([1, 2, 3]);
        expect(result.list.map((item) => item.no)).toEqual(["1"]);
    });

    it("10쪽까지만 받고 잘렸다고 알린다", async () => {
        const pages = serveComments(12, (page) => [comment(page)]);
        const result = await fetchComments(preData({commentCount: 5000}), {}, signal());
        expect(pages()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        expect(result.truncated).toBe(true);
    });

    it("댓글 수를 모르면 1쪽부터 읽는다", async () => {
        const pages = serveComments(3, (page) => [comment(page)]);
        await fetchComments(preData({commentCount: Number.NaN}), {}, signal());
        expect(pages()).toEqual([1, 2, 3]);
    });

    it("쪽 나눔이 없으면 1쪽만 받는다", async () => {
        const sent = serve(fetchMock, () => JSON.stringify({comments: null, total_cnt: 0, pagination: null}));
        const result = await fetchComments(preData(), {}, signal());
        expect(sent).toHaveLength(1);
        expect(result.list).toEqual([]);
    });

    it("allow_reply가 0이면 댓글을 막는다", async () => {
        serveComments(1, () => [], {allow_reply: "0"});
        expect((await fetchComments(preData(), {}, signal())).allowReply).toBe(false);
        serveComments(1, () => [], {allow_reply: null});
        expect((await fetchComments(preData(), {}, signal())).allowReply).toBe(true);
    });

    it("댓글 요청 값을 보낸다", async () => {
        const sent = serve(fetchMock, () => JSON.stringify({comments: [], total_cnt: 0, pagination: ""}));
        await fetchComments(preData({gallery: "a", id: "3", link: "https://gall.dcinside.com/mgallery/board/view/?id=a&no=3"}), {commentId: "cid", commentNo: "9", esno: "tok"}, signal());
        expect(sent[0]?.url).toBe(urls.comments);
        expect(Object.fromEntries(sent[0]?.body ?? [])).toEqual({ci_t: "", _GALLTYPE_: "M", id: "a", no: "3", cmt_id: "cid", cmt_no: "9", e_s_n_o: "tok", comment_page: "1"});
    });

    it("댓글 id가 없으면 글 값을 쓴다", async () => {
        const sent = serve(fetchMock, () => JSON.stringify({comments: [], total_cnt: 0, pagination: ""}));
        await fetchComments(preData({gallery: "a", id: "3"}), {}, signal());
        expect(sent[0]?.body.get("cmt_id")).toBe("a");
        expect(sent[0]?.body.get("cmt_no")).toBe("3");
        expect(sent[0]?.body.get("e_s_n_o")).toBe("");
    });

    it("한 쪽이 실패하면 나머지를 끊고 처음 실패를 던진다", async () => {
        const aborted: number[] = [];
        serve(fetchMock, ({body, signal: requestSignal}) => {
            const page = Number(body.get("comment_page"));
            if (page === 2) return new Response("", {status: 500});
            // 다른 쪽은 끊길 때까지 걸려 있다.
            return new Promise((_, reject) => requestSignal.addEventListener("abort", () => {
                aborted.push(page);
                reject(requestSignal.reason);
            }));
        });
        const error = await fetchComments(preData({commentCount: 300}), {}, signal()).catch((e: unknown) => e);
        expect(error).toBeInstanceOf(HTTPError);
        expect(aborted.toSorted()).toEqual([1, 3]);
    });

    it("호출한 쪽이 끊으면 요청도 끊긴다", async () => {
        const controller = new AbortController();
        serve(fetchMock, ({signal: requestSignal}) => new Promise((_, reject) => requestSignal.addEventListener("abort", () => reject(requestSignal.reason))));
        const pending = fetchComments(preData(), {}, controller.signal);
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
        controller.abort();
        await expect(pending).rejects.toThrow();
    });
});

describe("vote", () => {
    const stubCookies = () => {
        const set = vi.fn(async () => undefined);
        vi.stubGlobal("cookieStore", {get: async () => null, set});
        return set;
    };

    it("추천 쿠키를 굽고 추천 값을 보낸다", async () => {
        const set = stubCookies();
        const sent = serve(fetchMock, () => "true||12||3");
        const result = await vote(preData({gallery: "a", id: "3"}), post({recommendCode: "rec", v_cur_t: "vc", randomParam: {name: "r_x", value: "rv"}}), "U");
        expect(result).toEqual({success: true, counts: "12", fixedCounts: "3"});
        expect(set).toHaveBeenCalledWith(expect.objectContaining({name: "a3_Firstcheck", value: "Y", domain: "dcinside.com"}));
        expect(sent[0]?.url).toBe(urls.vote);
        expect(Object.fromEntries(sent[0]?.body ?? [])).toEqual({ci_t: "", _GALLTYPE_: "G", id: "a", no: "3", mode: "U", code_recommend: "rec", link_id: "a", v_cur_t: "vc", r_x: "rv"});
    });

    it("비추천은 _down 쿠키를 굽고 준 코드를 쓴다", async () => {
        const set = stubCookies();
        const sent = serve(fetchMock, () => "true||1");
        await vote(preData({gallery: "a", id: "3"}), post({recommendCode: "rec"}), "D", "captcha");
        expect(set).toHaveBeenCalledWith(expect.objectContaining({name: "a3_Firstcheck_down"}));
        expect(sent[0]?.body.get("code_recommend")).toBe("captcha");
        expect(sent[0]?.body.has("v_cur_t")).toBe(false);
    });

    it("실패하면 디시 문구를 준다", async () => {
        stubCookies();
        serve(fetchMock, () => "false||이미 추천하셨습니다.");
        expect(await vote(preData(), post(), "U")).toEqual({success: false, message: "이미 추천하셨습니다."});
    });
});

describe("댓글 관리", () => {
    const target = () => preData({gallery: "a", id: "3", link: "https://gall.dcinside.com/mini/board/view/?id=a&no=3"});

    it("고른 댓글을 한 번에 지운다", async () => {
        const sent = serve(fetchMock, () => JSON.stringify({result: "success"}));
        expect(await adminDeleteComments(target(), ["7", "8"])).toEqual({success: true, message: undefined});
        expect(sent[0]?.url).toBe(`${urls.base}ajax/mini_manager_board_ajax/delete_comment`);
        expect([...sent[0]?.body ?? []]).toEqual([["ci_t", ""], ["_GALLTYPE_", "MI"], ["id", "a"], ["pno", "3"], ["cmt_nos[]", "7"], ["cmt_nos[]", "8"]]);
    });

    it("댓글 작성자 차단은 글 번호를 parent로 보낸다", async () => {
        const sent = serve(fetchMock, () => JSON.stringify({result: "success"}));
        await blockCommenters(target(), ["7", "8"], {avoidHour: "1", avoidReason: "1", avoidReasonTxt: "", delChk: true, userTypeChk: false});
        expect(sent[0]?.body.getAll("nos[]")).toEqual(["7", "8"]);
        expect(sent[0]?.body.get("parent")).toBe("3");
        expect(sent[0]?.body.get("del_chk")).toBe("1");
    });
});
