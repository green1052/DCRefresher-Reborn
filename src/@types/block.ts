export {};

declare global {
    type RefresherBlock = typeof import("../core/block");

    type RefresherBlockType =
        | "NICK"
        | "ID"
        | "IP"
        | "TITLE"
        | "TEXT"
        | "COMMENT"
        | "DCCON"
        | "TAB"
        | "IMAGE";

    type RefresherBlockDetectMode =
        | "SAME"
        | "CONTAIN"
        | "NOT_SAME"
        | "NOT_CONTAIN";

    interface RefresherBlockValue {
        content: string;
        isRegex: boolean;
        isAdvanced: boolean;
        gallery?: string;
        extra?: string;
        mode?: RefresherBlockDetectMode;
    }
}
