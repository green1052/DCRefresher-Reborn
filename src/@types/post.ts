import type {User} from "../utils/user";

export {};

declare global {
    interface IPostInfo {
        id: string;
        header?: string;
        title?: string;
        date?: string;
        expire?: string;
        user?: User;
        views?: string;
        upvotes?: string;
        downvotes?: string;
        contents?: string;
        commentId?: string;
        commentNo?: string;
        commentCount?: number;
        isNotice?: boolean;
        isAdult?: boolean;
        requireCaptcha?: boolean;
        requireCommentCaptcha?: boolean;
        disabledDownvote?: boolean;
        v_cur_t?: string;
        randomParam?: { name: string, value: string };
        dom?: Document;
    }

    interface GalleryPreData {
        gallery: string;
        id: string;
        title?: string;
        link?: string;
        notice?: boolean;
        recommend?: boolean;
        type: string;
    }
}
