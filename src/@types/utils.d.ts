export {};

declare global {
    type RefresherHTTP = typeof import("../utils/http")

    type RefresherDOM = typeof import("../utils/dom")

    interface ISPInfo {
        name?: string;
        country?: string;
        color: string;
        detail?: string
    }

    interface RefresherIP {
        ISPData: (ip: string) => ISPInfo
        format: (data: ISPInfo) => string
    }
}