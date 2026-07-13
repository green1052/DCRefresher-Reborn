export {};

declare global {
    interface RefresherFilteringLists {
        func: (element: HTMLElement) => void;
        scope: string;
        options?: RefresherFilteringOptions;
        expire?: () => void;
    }

    interface RefresherFilteringOptions {
        neverExpire?: boolean;
        skipIfNotExists?: boolean;
    }

    interface BlockRequestOptions {
        target: "user" | "dccon";
        blockAllDccon?: boolean;
    }

    interface RefresherEventMap {
        refresh: [];
        refresherUpdateSetting: [string, string, unknown];
        refresherSettingsSync: [Record<string, Record<string, RefresherSettings>>];
        refresherUpdateUserMemo: [];
        refresherUserContextMenu: [string | null, string | null, string | null, string | null, string | null];
        refresherRequestBlock: [BlockRequestOptions];
        RefresherPostDataLoaded: [IPostInfo];
        RefresherPostCommentIDLoaded: [string | undefined, string | undefined];
        contentPreview: [HTMLElement];
        newPostList: [HTMLElement[]];
        refresherGetPost: [Document];
        refreshRequest: [];
    }
}