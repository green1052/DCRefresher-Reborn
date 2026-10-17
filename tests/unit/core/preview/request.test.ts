import {HTTPError} from "ky";
import {afterEach, describe, expect, it, vi} from "vitest";

const fetchMock = vi.hoisted(() => (globalThis.fetch = vi.fn<typeof fetch>()));

import {BlockedError} from "@/core/http/client";
import {urls} from "@/core/http/urls";
import {
    adminDeleteComments,
    blockCommenters,
    bump,
    fetchComments,
    fetchDcconList,
    fetchDcconPackage,
    fetchPost,
    setNotice,
    setRecommend,
    submitComment,
    userDeleteComment,
    viewUrl,
    vote
} from "@/core/preview/request";
import {D_ALPHABET} from "@/core/preview/dcinside-js";
import {submitTxtcon} from "@/core/preview/txtcon";
import type {DcinsideComment, DcinsideDcconDetailList, PostInfo} from "@/core/preview/types";

import {dcComment as comment, preData} from "../../../helpers";
import {serve} from "./net";

afterEach(() => void vi.unstubAllGlobals());

const signal = () => new AbortController().signal;

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

    it("댓글 목록이 아닌 응답은 던진다", async () => {
        for (const reply of ["null", "[]", "\"error\"", JSON.stringify({comments: "x", pagination: null})]) {
            serve(fetchMock, () => reply);
            await expect(fetchComments(preData(), {}, signal())).rejects.toThrow("댓글 목록이 아닙니다.");
        }
    });

    it("모양이 다른 댓글과 쪽 나눔은 버린다", async () => {
        const sent = serve(fetchMock, () => JSON.stringify({comments: [comment(1), null, {no: 2}, {no: "3", memo: null}, {...comment(4), no: 4}], pagination: 5}));
        const result = await fetchComments(preData(), {}, signal());
        expect(sent).toHaveLength(1);
        expect(result.list.map((item) => item.no)).toEqual(["1", "3"]);
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

describe("디시콘", () => {
    it("패키지 정보가 아닌 응답은 던진다", async () => {
        for (const reply of ["null", "[]", JSON.stringify({info: null, detail: [], tags: []}), JSON.stringify({info: {}, detail: {}, tags: []})]) {
            serve(fetchMock, () => reply);
            await expect(fetchDcconPackage("1")).rejects.toThrow("디시콘 정보가 아닙니다.");
        }
    });

    it("목록이 아닌 응답은 던진다", async () => {
        for (const reply of ["null", "[]", JSON.stringify({target: "icon", list: null})]) {
            serve(fetchMock, () => reply);
            await expect(fetchDcconList(signal())).rejects.toThrow("디시콘 목록이 아닙니다.");
        }
    });

    it("상점 안내와 비로그인을 알린다", async () => {
        serve(fetchMock, () => JSON.stringify({target: "shop"}));
        expect(await fetchDcconList(signal())).toBe("shop");
        serve(fetchMock, () => "not_login");
        expect(await fetchDcconList(signal())).toBe("not_login");
    });

    const pack = (page: number): DcinsideDcconDetailList => ({package_idx: String(page), title: `콘${page}`, main_img_url: "", detail: []});

    /** 쪽마다 그 쪽 번호의 패키지 하나를 준다. 요청한 쪽 번호를 모은다. */
    const servePages = (maxPage: number | string, reply = (page: number): string => JSON.stringify({target: "icon", max_page: maxPage, list: [pack(page)]})) => {
        const sent = serve(fetchMock, ({body}) => reply(Number(body.get("page"))));
        return () => sent.map(({body}) => Number(body.get("page"))).toSorted((a, b) => a - b);
    };

    it("문자열 max_page까지 모든 쪽을 받아 쪽 순서대로 잇는다", async () => {
        const pages = servePages("2");
        expect(await fetchDcconList(signal())).toEqual([pack(0), pack(1), pack(2)]);
        expect(pages()).toEqual([0, 1, 2]);
    });

    it("20쪽까지만 받는다", async () => {
        const pages = servePages(30);
        expect(await fetchDcconList(signal())).toHaveLength(20);
        expect(pages()).toEqual(Array.from({length: 20}, (_, index) => index));
    });

    it("뒤쪽이 비로그인이면 그 쪽만 뺀다", async () => {
        servePages(2, (page) => (page === 1 ? "not_login" : JSON.stringify({target: "icon", max_page: 2, list: [pack(page)]})));
        expect(await fetchDcconList(signal())).toEqual([pack(0), pack(2)]);
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

    it("비밀번호 삭제는 글의 댓글 갤러리로 보내고 no는 글 번호다. 디시처럼 rc_key·c_k_v·v_cur_t와 재전송 토큰을 붙인다", async () => {
        const sent = serve(fetchMock, () => "true");
        expect(await userDeleteComment(target(), {commentId: "cid", v_cur_t: "vt"}, "7", "pw", "new3", "tok")).toEqual({result: "true", message: undefined, detail: undefined});
        expect(sent[0]?.url).toBe(urls.comment_remove);
        expect(Object.fromEntries(["id", "no", "re_no", "re_password", "v_cur_t", "rc_key", "c_k_v", "g-recaptcha-token"].map((key) => [key, sent[0]?.body.get(key)]))).toEqual({
            id: "cid", no: "3", re_no: "7", re_password: "pw", v_cur_t: "vt", rc_key: "new3", c_k_v: "dzc", "g-recaptcha-token": "tok"
        });
    });
    it("성공이라고 밝힌 응답만 성공으로 본다", async () => {
        const cases: [string, { success: boolean; message?: string }][] = [
            [JSON.stringify({result: "success", msg: "삭제되었습니다."}), {success: true, message: "삭제되었습니다."}],
            [JSON.stringify({result: "fail", msg: "권한이 없습니다."}), {success: false, message: "권한이 없습니다."}],
            [JSON.stringify({result: "fail", msg: ""}), {success: false, message: undefined}],
            ["true", {success: true, message: undefined}],
            ["false||정상적인 접근이 아닙니다.", {success: false, message: "정상적인 접근이 아닙니다."}],
            ["false||nomember||로그인이 필요합니다.", {success: false, message: "로그인이 필요합니다."}],
            // 세션이 끊기면 로그인 페이지 HTML이 온다.
            ["<!DOCTYPE html><html><body>로그인</body></html>", {success: false, message: undefined}],
            // 인라인 스크립트의 ||를 칸 구분으로 잘라 조각을 안내 문구로 쓰면 안 된다.
            ["<!DOCTYPE html><html><head><script>window.dataLayer = window.dataLayer || [];</script></head><body>로그인</body></html>", {success: false, message: undefined}]
        ];
        for (const [reply, result] of cases) {
            serve(fetchMock, () => reply);
            expect(await adminDeleteComments(target(), ["7"])).toEqual(result);
        }
    });

    it("끌올·공지·개념글은 갤러리 종류의 관리 주소로 글 번호를 보낸다", async () => {
        const sent = serve(fetchMock, () => JSON.stringify({result: "success"}));
        await bump(target());
        await setNotice(target(), true);
        await setNotice(target(), false);
        await setRecommend(target(), true);
        await setRecommend(target(), false);

        expect(sent.map(({url, body}) => [url.replace(`${urls.base}ajax/mini_manager_board_ajax/`, ""), [...body].slice(2)])).toEqual([
            ["update_bump", [["id", "a"], ["nos[]", "3"]]],
            ["set_notice", [["mode", "SET"], ["id", "a"], ["no", "3"]]],
            ["set_notice", [["mode", "REL"], ["id", "a"], ["no", "3"]]],
            ["set_recommend", [["mode", "SET"], ["id", "a"], ["nos[]", "3"]]],
            ["set_recommend", [["mode", "REL"], ["id", "a"], ["nos[]", "3"]]]
        ]);
    });
});

describe("submitComment", () => {
    /** 디시 _d()가 푸는 값. 표준 base64를 디시가 섞은 알파벳으로 옮긴다. */
    const dValue = (plain: string) => Array.from(btoa(plain), (char) => D_ALPHABET["ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=".indexOf(char)]).join("");
    const form = (value?: string): PostInfo => post({commentForm: {fields: [["service_code", "x"], ["check_6", "c6"]], serviceCode: "abc0123456789", dValue: value, checks: {}}});
    const submit = (info: PostInfo) => submitComment(preData({gallery: "a", id: "3"}), info, {user: {name: "ㅇㅇ", pw: "1234"}, memo: "댓글", commentNo: null, replyNo: null, bigDccon: false});

    it("_d() 값을 풀어 service_code 끝 10자리를 갈아 끼운다", async () => {
        const sent = serve(fetchMock, () => "1234");
        // "e2eRefresh"를 푸는 값. 첫 자리 6을 4 당겨 2로 적는다.
        expect(await submit(form(dValue("207,277,508,373,409,363,349,260.5,239,166")))).toEqual({result: "1234", message: undefined, detail: undefined});
        expect(sent[0]?.url).toBe(urls.comments_submit);
        expect(sent[0]?.body.get("service_code")).toBe("abce2eRefresh");
        expect(sent[0]?.body.get("check_6")).toBe("c6");
    });

    it("값이 없거나 숫자로 풀리지 않으면 보내지 않고 알린다", async () => {
        serve(fetchMock, () => "1234");
        for (const value of [undefined, dValue("x07,277"), dValue("207,abc,508"), "!!!!"]) {
            expect(await submit(form(value))).toEqual({result: "false", message: "댓글 폼을 읽지 못했습니다. 원문에서 작성해 주세요."});
        }
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe("submitTxtcon", () => {
    it("글 댓글과 같은 대상에 글자콘 값을 보내고, 회원이면 name·password를 빼고 보낸다", async () => {
        const sent = serve(fetchMock, () => "ok");
        const info = post({commentId: "cid", commentNo: "9", commentForm: {fields: [], serviceCode: "", checks: {check_6: "c6", check_7: "c7", check_8: ""}, gallNickName: "갤닉"}});
        const options = {text: "안녕", colors: {bg: "333333", txt: "ffffff"}, commentNo: "10", replyNo: "11", grecaptchaToken: "tok"};
        await submitTxtcon(preData({gallery: "a", id: "3"}), info, {...options, user: {name: "ㅇㅇ", pw: "pw"}});
        await submitTxtcon(preData({gallery: "a", id: "3"}), info, {...options, user: {name: ""}});

        expect(sent[0]?.url).toBe(urls.txtcon_submit);
        const keys = ["id", "no", "txtcon_text", "txtcon_bg", "txtcon_color", "c_no", "reply_no", "name", "password", "check_6", "check_7", "check_8", "gall_nick_name", "use_gall_nick", "g-recaptcha-token"];
        expect(Object.fromEntries(keys.map((key) => [key, sent[0]?.body.get(key)]))).toEqual({
            id: "cid", no: "9", txtcon_text: "안녕", txtcon_bg: "333333", txtcon_color: "ffffff", c_no: "10", reply_no: "11", name: "ㅇㅇ", password: "pw",
            check_6: "c6", check_7: "c7", check_8: "", gall_nick_name: "갤닉", use_gall_nick: "N", "g-recaptcha-token": "tok"
        });
        expect([sent[1]?.body.has("name"), sent[1]?.body.has("password")]).toEqual([false, false]);
    });
});
