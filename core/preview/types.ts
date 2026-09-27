export interface GalleryPreData {
    gallery: string;
    id: string;
    title?: string;
    link: string;
    notice: boolean;
    recommend: boolean;
    type: string;
}

export interface User {
    id?: string;
    nick?: string;
    ip?: string;
    image?: string;
}

export interface PostInfo {
    header?: string;
    title?: string;
    expire?: string;
    /** 작성 시각 "2026-09-26 02:29:40" */
    date?: string;
    user?: User;
    views?: string;
    upvotes?: string;
    fixedUpvotes?: string;
    downvotes?: string;
    contents?: string;
    /** 본문이 차단 대상 — 차단 모듈 설정대로 흐리게(blur) 또는 안내로 가린다(hide) */
    textBlocked?: "blur" | "hide";
    commentId?: string;
    commentNo?: string;
    commentCount?: number;
    requireCaptcha?: boolean;
    requireCommentCaptcha?: boolean;
    v_cur_t?: string;
    randomParam?: { name: string; value: string };
    /** 그 글의 댓글 요청 토큰 (#e_s_n_o) — 지금 페이지 것을 쓰면 다른 글의 값을 보낸다 */
    esno?: string;
    /** 그 글의 추천 토큰 (input[name=code_recommend]) */
    recommendCode?: string;
    /** 본문 글자 (.write_div) — 본문 차단 검사를 페이지와 같은 글자로 한다 (정화한 contents가 아니라) */
    writeText?: string;
    /** 댓글·글자콘 쓰기에 보내는 그 글의 폼 값 */
    commentForm: CommentForm;
}


/** 글 페이지의 댓글 폼에서 꺼내 둔 값 — 쓸 때 다시 읽으려고 문서째 들고 있지 않는다 */
export interface CommentForm {
    /** 댓글 폼(#focus_cmt)의 input들 — [이름(없으면 id), 값], 페이지 순서대로 */
    fields: [string, string][];
    /** service_code 원래 값 — 보낼 때 dValue로 끝 10자를 바꾼다 */
    serviceCode: string;
    /** 댓글 설정 스크립트(#reply-setting-tmpl 다음)의 _d('…') 인자 */
    dValue?: string;
    /** 글자콘 쓰기가 보내는 check_6~8 */
    checks: Record<string, string>;
    /** 갤닉 입력칸(#use_gall_nick)이 있으면 그 이름 — 없으면 undefined */
    gallNickName?: string;
}

export interface DcinsideDccon {
    detail_idx: string;
    list_img: string;
    package_idx: string;
    title: string;
}

export interface DcinsideDcconDetailList {
    detail: DcinsideDccon[];
    main_img_url: string;
    package_idx: string;
    title: string;
}

export interface DcinsideDcconDetail {
    list: DcinsideDcconDetailList[];
    max_page: number;
    target: string;
}

export interface DcinsideComment {
    no: string;
    c_no: string;
    depth: number;
    user_id: string;
    name: string;
    gallog_icon?: string;
    ip: string;
    memo: string;
    /** "0" 살아 있음, 그 밖은 삭제 — 가공하면 "0"/"1"만 남는다 (comments.ts) */
    is_delete: string;
    del_btn?: "Y" | "N";
    my_cmt?: "Y" | "N";
    date_time: string;
    reg_date?: string;

    [key: string]: unknown;
}

export interface CommentListResponse {
    list: DcinsideComment[];
    /** 댓글·답글 쓰기 허용 (allow_reply) — 멤버만 댓글인 갤러리면 false */
    allowReply: boolean;
}
