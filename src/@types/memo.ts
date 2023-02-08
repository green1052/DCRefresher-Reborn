export {};

declare global {
    type RefresherMemo = typeof import("../core/memo");

    type RefresherMemoType = "UID" | "NICK" | "IP";

    interface RefresherMemoValue {
        text: string;
        color: string;
        gallery?: string;
    }
}
