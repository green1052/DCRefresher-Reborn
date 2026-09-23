export {};

declare global {
    interface RefresherFilteringOptions {
        neverExpire?: boolean;
        skipIfNotExists?: boolean;
    }

    interface BlockRequestOptions {
        target: "user" | "dccon";
        blockAllDccon?: boolean;
    }

    // 우클릭한 대상. 유저(nick/id/ip)와 디시콘(code)은 동시에 없다.
    interface RefresherUserContextData {
        nick: string | null;
        id: string | null;
        ip: string | null;
        code: string | null;
        packageIdx: string | null;
    }

    interface RefresherEventMap {
        refresherUpdateSetting: [string, string, unknown];
        refresherUpdateUserMemo: [];
        refresherUserContextMenu: [RefresherUserContextData];
        refresherRequestBlock: [BlockRequestOptions];
        RefresherPostDataLoaded: [IPostInfo];
        RefresherPostCommentIDLoaded: [string | undefined, string | undefined];
        contentPreview: [HTMLElement];
        newPostList: [HTMLElement[]];
        refresherGetPost: [Document];
        refreshRequest: [];
    }
}