import storage from "./storage";
import { Nullable } from "./types";

const ipData: Record<string, string> = await storage.get("refresher.database.ip");

export const ISPData = (ip: string): ISPInfo => {
    return {
        name: ipData?.[ip],
        color: "#6495ed"
    };
};

export const format = (data: ISPInfo): Nullable<string> => {
    const { name } = data;
    return name ?? null;
};

export default {
    ISPData,
    format
};
