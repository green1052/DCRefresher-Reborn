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
    /** 본문이 차단에 걸렸을 때 가리는 방식 (차단 모듈 설정). blur는 흐리게, hide는 안내문으로 가린다 */
    textBlocked?: "blur" | "hide";
    commentId?: string;
    commentNo?: string;
    commentCount?: number;
    requireCaptcha?: boolean;
    requireCommentCaptcha?: boolean;
    v_cur_t?: string;
    randomParam?: { name: string; value: string };
    /** 그 글의 댓글 요청 토큰 (#e_s_n_o). 현재 페이지의 값은 다른 글의 것이라 쓰면 안 된다 */
    esno?: string;
    /** 그 글의 추천 토큰 (input[name=code_recommend]) */
    recommendCode?: string;
    /** 본문 텍스트 (.write_div). 본문 차단 검사를 정화한 contents가 아니라 페이지와 같은 텍스트로 하려고 둔다 */
    writeText?: string;
    /** 댓글·글자콘 쓰기에 보내는 그 글의 폼 값 */
    commentForm: CommentForm;
}


/** 글 페이지의 댓글 폼에서 미리 꺼내 둔 값. 댓글을 쓸 때 다시 읽으려고 파싱한 문서를 들고 있지 않는다 (parser.ts) */
export interface CommentForm {
    /** 댓글 폼(#focus_cmt)의 input들. [이름(없으면 id), 값]을 페이지 순서대로 담는다 */
    fields: [string, string][];
    /** service_code 원래 값. 보낼 때 끝 10자를 dValue로 계산한 값으로 바꾼다 */
    serviceCode: string;
    /** 댓글 설정 스크립트(#reply-setting-tmpl 다음)의 _d('…') 인자 */
    dValue?: string;
    /** 글자콘 쓰기가 보내는 check_6~8 */
    checks: Record<string, string>;
    /** 갤닉 입력칸(#use_gall_nick)이 있으면 #gall_nick_name의 값, 없으면 undefined */
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
    /** 마지막 쪽 번호 (0부터). 문자열로 오기도 한다 */
    max_page: number | string;
    target: string;
}

export interface DcinsideComment {
    no: string;
    c_no: string;
    depth: number;
    user_id: string;
    name: string;
    gallog_icon?: string;
    /** 닉네임 칸 HTML — 유동은 여기에 IP가 들어 있기도 하다 */
    nickname?: string;
    /** "COMMENT_BOY"면 댓글돌이 */
    nicktype?: string;
    ip: string;
    memo: string;
    /** "0"이면 살아 있고 그 밖은 삭제. prepareComments(comments.ts)를 거치면 "0"/"1"만 남는다 */
    is_delete: string;
    /** "Y"면 디시가 지운 댓글 */
    del_yn?: "Y" | "N";
    del_btn?: "Y" | "N";
    /** "N"이면 답글을 막은 댓글 */
    reply_w?: "Y" | "N";
    my_cmt?: "Y" | "N";
    date_time: string;
    reg_date?: string;
}

export interface CommentListResponse {
    list: DcinsideComment[];
    /** 댓글·답글 쓰기 허용 (allow_reply). 멤버만 댓글을 쓰는 갤러리면 false */
    allowReply: boolean;
}
