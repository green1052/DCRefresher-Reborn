export interface GalleryPreData {
    gallery: string;
    id: string;
    title?: string;
    link?: string;
    notice?: boolean;
    recommend?: boolean;
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
    /** 댓글·추천 요청의 토큰을 읽을 그 글의 문서 — 지금 페이지 document로 대신하면 다른 글의 값을 보낸다 */
    dom: Document;
}


export interface DcinsideDccon {
    detail_idx: string;
    list_img: string;
    package_idx: string;
    package_title: string;
    sort: string;
    title: string;
}

export interface DcinsideDcconDetailList {
    detail: DcinsideDccon[];
    detail_page: string;
    end_date: string;
    icon_cnt: string;
    main_img_url: string;
    package_idx: string;
    sort: string;
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
    total_cnt: number;
}
