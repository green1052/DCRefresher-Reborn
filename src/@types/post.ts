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
        isNotice?: boolean;
        isAdult?: boolean;
        requireCaptcha?: boolean;
        requireCommentCaptcha?: boolean;
        disabledDownvote?: boolean;
        dom?: Document;
    }

    interface GalleryPreData {
        gallery: string;
        id: string;
        title?: string;
        link?: string;
        notice?: boolean;
        recommend?: boolean;
    }
}
