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
    Type?: string;
    image?: string;
}

export interface PostInfo {
    id: string;
    header?: string;
    title?: string;
    date?: string;
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
    isAdult?: boolean;
    requireCaptcha?: boolean;
    requireCommentCaptcha?: boolean;
    disabledDownvote?: boolean;
    v_cur_t?: string;
    randomParam?: {name: string; value: string};
    dom?: Document;
}

/** 하위 호환 별칭 (parser/cache/request) */
export type IPostInfo = PostInfo;
