/**
 * 관리 API의 차단 기간(시간 → 라벨). 차단 팝업과 차단 프리셋 설정(features/preview/meta.ts)이 같이 쓴다.
 * 키가 정수 모양이라 객체 순서는 오름차순이다.
 */
export const BLOCK_DAYS = {"1": "1시간", "6": "6시간", "24": "1일", "168": "7일", "336": "14일", "744": "31일"} as const;
export type BlockDay = keyof typeof BLOCK_DAYS;

/** 관리 API의 차단 사유. "0"은 직접 입력이다. 객체로 두면 "0"이 맨 앞으로 오므로 순서대로 배열에 둔다. */
export const BLOCK_REASONS = [
    ["1", "음란성"],
    ["2", "광고"],
    ["3", "욕설"],
    ["4", "도배"],
    ["5", "저작권 침해"],
    ["6", "명예훼손"],
    ["0", "직접 입력"]
] as const;
export type BlockReason = (typeof BLOCK_REASONS)[number][0];

export interface GalleryPreData {
    gallery: string;
    id: string;
    title?: string;
    link: string;
    notice: boolean;
    recommend: boolean;
    type: string;
    /** 목록에 보인 댓글 수 (없으면 0). 댓글을 본문과 함께 요청할지, 댓글을 몇 쪽 한꺼번에 받을지 정한다. */
    commentCount: number;
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
    /** 작성 시각 ("2026-09-26 02:29:40"). */
    date?: string;
    user?: User;
    views?: string;
    upvotes?: string;
    fixedUpvotes?: string;
    downvotes?: string;
    contents?: string;
    /** 본문이 차단에 걸렸을 때 가리는 방식 (차단 모듈 설정). blur는 흐리게, hide는 안내문으로 가린다. */
    textBlocked?: "blur" | "hide";
    commentId?: string;
    commentNo?: string;
    commentCount?: number;
    requireCaptcha?: boolean;
    requireCommentCaptcha?: boolean;
    v_cur_t?: string;
    randomParam?: { name: string; value: string };
    /** 그 글의 댓글 요청 토큰 (#e_s_n_o). 갤러리마다 같아 지금 페이지의 값으로 미리 요청하지만, 쓰기 전에 이 값과 맞춰 본다 (features/preview/index.ts의 load). */
    esno?: string;
    /** 그 글의 추천 토큰 (input[name=code_recommend]). */
    recommendCode?: string;
    /** 본문 텍스트 (.write_div). 본문 차단 검사를 정화한 contents가 아니라 페이지와 같은 텍스트로 하려고 둔다. */
    writeText?: string;
    /** 댓글·글자콘 쓰기에 보내는 그 글의 폼 값. */
    commentForm: CommentForm;
}


/** 글 페이지의 댓글 폼에서 미리 꺼내 둔 값. 댓글을 쓸 때 다시 읽으려고 파싱한 문서를 들고 있지 않는다 (core/preview/parser.ts). */
export interface CommentForm {
    /** 댓글 폼(#focus_cmt)의 input들. [이름(없으면 id), 값]을 페이지 순서대로 담는다. */
    fields: [string, string][];
    /** service_code 원래 값. 보낼 때 끝 10자를 dValue로 계산한 값으로 바꾼다. */
    serviceCode: string;
    /** 댓글 설정 스크립트(#reply-setting-tmpl 다음)의 _d('…') 인자. */
    dValue?: string;
    /** 글자콘 쓰기가 보내는 check_6~8. */
    checks: Record<string, string>;
    /** 갤닉 입력칸(#use_gall_nick)이 있으면 #gall_nick_name의 값, 없으면 undefined다. */
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
    /** 디시콘이 하나도 없으면(target "shop") 오지 않는다. */
    list?: DcinsideDcconDetailList[];
    /** 마지막 쪽 번호 (0부터). 문자열로 오기도 한다. */
    max_page: number | string;
    target: string;
}

/** package_detail이 주는 디시콘 패키지 정보. */
interface DcinsideDcconPackageInfo {
    package_idx: string | number;
    code: string;
    title: string;
    description: string;
    seller_name: string;
    reg_date_short: string;
    /** 대표 이미지. dcimg5.dcinside.com/dccon.php?no= 뒤에 붙인다. */
    main_img_path: string;
    /** 내가 올린 패키지 (디시는 '사용' 대신 '수정'을 띄운다). */
    register: boolean;
    /** 가진 패키지면 남은 기간 문자열(무기한은 "-"), 없으면 false. 디시는 가진 패키지에 '사용'을 띄우지 않는다. */
    residual: string | false;
}

/** 패키지 안의 디시콘 하나. */
interface DcinsideDcconPackageItem {
    idx: string;
    /** 이미지. dcimg5.dcinside.com/dccon.php?no= 뒤에 붙인다. */
    path: string;
    title: string;
}

/** /dccon/package_detail 응답. */
export interface DcinsideDcconPackage {
    info: DcinsideDcconPackageInfo;
    detail: DcinsideDcconPackageItem[];
    tags: { tag: string }[];
}

export interface DcinsideComment {
    no: string;
    c_no: string;
    depth: number;
    user_id: string;
    name: string;
    gallog_icon?: string;
    /** 닉네임 칸 HTML — 유동은 여기에 IP가 들어 있기도 하다. */
    nickname?: string;
    /** "COMMENT_BOY"면 댓글돌이. */
    nicktype?: string;
    ip: string;
    memo: string;
    /** "0"이면 살아 있고 그 밖은 삭제. prepareComments(core/preview/comments.ts)를 거치면 "0"/"1"만 남는다. */
    is_delete: string;
    /** "Y"면 디시가 지운 댓글. */
    del_yn?: "Y" | "N";
    del_btn?: "Y" | "N";
    /** "N"이면 답글을 막은 댓글. */
    reply_w?: "Y" | "N";
    my_cmt?: "Y" | "N";
    date_time: string;
    reg_date?: string;
}

export interface CommentListResponse {
    list: DcinsideComment[];
    /** 댓글·답글 쓰기 허용 (allow_reply). 멤버만 댓글을 쓰는 갤러리면 false다. */
    allowReply: boolean;
    /** 10쪽(1000개)을 넘어 오래된 댓글을 받지 못했는지. */
    truncated?: boolean;
}
