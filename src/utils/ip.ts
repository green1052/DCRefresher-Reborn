import type {Nullable} from "./types";

import storage from "./webStorage";

let ipData: Record<string, string> = {};

(async () => {
    ipData = await storage.get<Record<string, string>>("refresher.database.ip");
})();

export const ISPData = (ip: string): ISPInfo => {
    if (!Object.keys(ipData).length) return { name: undefined, color: "#6495ed" };

    return {
        name: ipData?.[ip],
        color: "#6495ed"
    };
};

export const format = (data: ISPInfo): Nullable<string> => {
    const {name} = data;
    return name ?? null;
};

export default {
    ISPData,
    format
};