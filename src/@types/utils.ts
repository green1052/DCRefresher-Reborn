export {};

declare global {
    type RefresherHTTP = typeof import("../utils/http");

    interface ISPInfo {
        name?: string;
        country?: string;
        color: string;
        detail?: string;
    }

    type RefresherIP = typeof import("../utils/ip");
}
