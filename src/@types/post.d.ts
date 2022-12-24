export {};

declare global {
    class PostInfo {
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
        requireCaptcha?: boolean;
        requireCommentCaptcha?: boolean;
        disabledDownvote?: boolean;
        dom?: Document;

        constructor(id: string, data: { [index: string]: unknown }) {
            this.id = id;

            const keys = Object.keys(data);
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];

                this[key] = data[key];
            }
        }
    }

    interface GalleryPreData {
        gallery: string
        id: string
        title?: string
        link?: string
        notice?: boolean
        recommend?: boolean
    }
}