import storage from "./storage";
import { Nullable } from "./types";

let ipData: Record<string, string> = {};

const initializeIPData = async (): Promise<void> => {
    try {
        ipData = (await storage.get<Record<string, string>>("refresher.database.ip")) || {};
    } catch (error) {
        console.error("Failed to initialize IP data:", error);
        ipData = {};
    }
};

initializeIPData();

export const ISPData = (ip: string): ISPInfo => {
    if (!ip) {
        return {
            name: undefined,
            color: "#6495ed"
        };
    }

    return {
        name: ipData?.[ip],
        color: "#6495ed"
    };
};

export const format = (data: ISPInfo): Nullable<string> => {
    if (!data) {
        return null;
    }

    const { name } = data;
    return name ?? null;
};

export const refreshIPData = async (): Promise<void> => {
    await initializeIPData();
};

export default {
    ISPData,
    format,
    refreshIPData
};
