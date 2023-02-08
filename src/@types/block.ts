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
        | "DCCON";

    type RefresherBlockDetectMode =
        | "SAME"
        | "CONTAIN"
        | "NOT_SAME"
        | "NOT_CONTAIN";

    interface RefresherBlockValue {
        content: string;
        isRegex: boolean;
        gallery?: string;
        extra?: string;
        mode?: RefresherBlockDetectMode;
    }
}
