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
    user?: User;
    views?: string;
    upvotes?: string;
    fixedUpvotes?: string;
    downvotes?: string;
    contents?: string;
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
    is_delete: "0" | "1";
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
