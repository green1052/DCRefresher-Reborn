import storage from "./storage";
import { Nullable } from "./types";

const ipData = storage.get<Record<string, string>>("refresher.database.ip");

export const ISPData = (ip: string): ISPInfo => {
    if (!ipData) throw new Error("IP data not loaded");

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
