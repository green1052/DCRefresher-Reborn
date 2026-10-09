/** 게시글·댓글 받기와 추천. 나머지 디시 요청은 각 파일(manage·submit·txtcon·dccon)로 나뉘어 있고 여기서 다시 내보낸다. */
import {ajax, http} from "@/core/http/client";
import {galleryPath, urls} from "@/core/http/urls";
import {isRecord} from "@/utils/record";

import {parsePostInfo} from "./parser";
import {dcBody, resultMessage, submitResult} from "./response";
import type {CommentListResponse, DcinsideComment, GalleryPreData, PostInfo} from "./types";

export {type BlockOptions, type ManageResult, adminDeleteComments, blockCommenters, blockUser, bump, captchaImage, deletePost, setNotice, setRecommend, userDeleteComment} from "./manage";
export {submitComment} from "./submit";
export {TXTCON_BACKGROUNDS, TXTCON_COLORS, normalizeTxtcon, submitTxtcon} from "./txtcon";
export {addDcconPackage, fetchDcconList, fetchDcconPackage} from "./dccon";
export {type SubmitResult, resultMessage} from "./response";

export const viewUrl = (link: string, gallery: string, id: string): string => `${urls.base}${galleryPath(link)}board/view/?id=${gallery}&no=${id}`;

/** 게시글을 받아 PostInfo로 푼다. 삭제된 글은 디시가 404를 주고, 임시 차단은 HTTP 클라이언트가 BlockedError로 던진다. 그 밖에 글이 없는 페이지면 Error를 던진다. */
export const fetchPost = async (preData: GalleryPreData, signal: AbortSignal): Promise<PostInfo> => {
    const response = await http.get(viewUrl(preData.link, preData.gallery, preData.id), {signal}).text();

    const postInfo = parsePostInfo(response);
    if (!postInfo) throw new Error("게시글 페이지가 아닙니다.");

    return postInfo;
};

// 번호로 묶어 정렬하므로 번호가 문자열인 항목만 댓글로 받는다. memo는 비어 올 수 있어 comments.ts에서 문자열로 바꾼다.
const isComment = (value: unknown): value is DcinsideComment => isRecord(value) && typeof value.no === "string";

/** 댓글 목록. 한 쪽에 100개씩이라 여러 쪽을 받아 합친다. */
export const fetchComments = async (preData: GalleryPreData, postInfo: Pick<PostInfo, "commentId" | "commentNo" | "esno">, signal: AbortSignal): Promise<CommentListResponse> => {
    const body = await dcBody(preData.link, {
        id: preData.gallery,
        no: preData.id,
        cmt_id: postInfo.commentId ?? preData.gallery,
        cmt_no: postInfo.commentNo ?? preData.id,
        e_s_n_o: postInfo.esno ?? ""
    });

    // 어느 쪽이든 실패하면(갱신 차단 등) 함께 보낸 다른 쪽 요청도 끊는다. 막힌 서버에 요청을 더 보내지 않는다.
    // 끊긴 쪽은 AbortError로 실패하는데, 그대로 던지면 사용자가 취소한 것으로 보여 실제 원인(임시 차단 등)이 묻힌다. 처음 실패를 던진다.
    const pageAbort = new AbortController();
    let failure: unknown;
    const pageSignal = AbortSignal.any([signal, pageAbort.signal]);
    const fetchPage = (page: number) => {
        const pageBody = new URLSearchParams(body);
        pageBody.set("comment_page", String(page));
        return ajax.post(urls.comments, {body: pageBody, signal: pageSignal}).json<unknown>().then((parsed) => {
            // 다른 모양(실패 응답 등)이면 쪽 나눔을 읽다 깨지므로 실패로 넘긴다 (dccon.ts의 fetchPage와 같다).
            if (!isRecord(parsed)) throw new Error("댓글 목록이 아닙니다.");
            const {comments, pagination, allow_reply} = parsed;
            if (comments !== null && !Array.isArray(comments)) throw new Error("댓글 목록이 아닙니다.");
            // 디시 comment.js처럼 0일 때만 막는다 (멤버만 댓글).
            return {comments: comments?.filter(isComment) ?? [], pagination: typeof pagination === "string" ? pagination : null, allowReply: String(allow_reply) !== "0"};
        }).catch((e: unknown) => {
            failure ??= e;
            pageAbort.abort();
            throw failure;
        });
    };

    // 목록의 댓글 수로 쪽 수를 어림해 1쪽과 함께 받는다. 1쪽을 받은 뒤에 나머지를 요청하면 댓글이 많은 글은 그만큼(수백 ms) 늦게 뜬다.
    // 목록의 수는 삭제된 댓글을 빼고 세어 모자랄 수 있으므로, 1쪽의 쪽 나눔(viewComments(n, …))에서 마지막 쪽 번호를 읽어 남은 쪽을 마저 받는다.
    // 1쪽을 먼저 요청해야 동시 요청 수(요청 제한 모듈)에 막혀도 쪽 나눔을 먼저 받는다. 1쪽이 실패하면 어림한 쪽의 실패는 버린다.
    // 10쪽(1000개)까지만 받는다. 더 많은 글은 드물고, 자동 갱신 때마다 전부 다시 받기 때문이다.
    const guessed = Math.min(10, Math.max(1, Math.ceil(preData.commentCount / 100)));
    const firstPage = fetchPage(1);
    const early = Promise.all(Array.from({length: guessed - 1}, (_, index) => fetchPage(index + 2)));
    early.catch(() => {});

    const first = await firstPage;
    const pages = Math.max(1, ...Array.from(first.pagination?.matchAll(/viewComments\((\d+)/g) ?? [], (match) => Number(match[1])));
    const rest = Promise.all(Array.from({length: Math.max(0, Math.min(10, pages) - guessed)}, (_, index) => fetchPage(guessed + index + 1)));
    const [earlyPages, restPages] = await Promise.all([early, rest]);

    // 1쪽이 가장 최근 댓글이고 뒤쪽일수록 오래된 댓글이다. 쪽 사이에 같은 댓글이 겹쳐 올 수 있어 번호로 하나만 남기고 번호(등록)순으로 맞춘다.
    const byNo = new Map<string, DcinsideComment>();
    for (const response of [first, ...earlyPages, ...restPages]) {
        for (const comment of response.comments) byNo.set(comment.no, comment);
    }

    return {list: [...byNo.values()].sort((a, b) => Number(a.no) - Number(b.no)), allowReply: first.allowReply, truncated: pages > 10};
};

interface VoteResult {
    success: boolean;
    counts?: string;
    fixedCounts?: string;
    /** 실패 이유 (디시가 준 문구). */
    message?: string;
}

/** 추천/비추천. */
export const vote = async (preData: GalleryPreData, postInfo: PostInfo, mode: "U" | "D", code?: string): Promise<VoteResult> => {
    await cookieStore.set({
        name: `${preData.gallery}${preData.id}_Firstcheck${mode === "U" ? "" : "_down"}`,
        value: "Y",
        expires: Date.now() + 3 * 3600_000,
        path: "/",
        domain: "dcinside.com"
    });

    const body = await dcBody(preData.link, {
        id: preData.gallery,
        no: preData.id,
        mode,
        code_recommend: code ?? postInfo.recommendCode ?? "",
        link_id: preData.gallery,
        v_cur_t: postInfo.v_cur_t || undefined,
        ...(postInfo.randomParam && {[postInfo.randomParam.name]: postInfo.randomParam.value})
    });

    // 성공이면 'true||추천 수||고정닉 추천 수'다.
    const response = submitResult(await ajax.post(urls.vote, {body}).text());
    return response.result === "true"
        ? {success: true, counts: response.message, fixedCounts: response.detail}
        : {success: false, message: resultMessage(response)};
};
