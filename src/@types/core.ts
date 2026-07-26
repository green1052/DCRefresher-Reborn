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

    interface RefresherEventMap {
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
        refresherModuleConfig: [string, Record<string, unknown>];
    }
}