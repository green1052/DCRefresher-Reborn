import type {Nullable} from "./types";

import {databaseStorage, onStorageValue} from "@/storage/wxtStorage";

let ipData: Record<string, string> = {};

// 백그라운드가 주기적으로 DB를 갱신하므로 열려 있는 탭도 따라가야 한다.
onStorageValue(databaseStorage.ip, (newValue) => {
    ipData = newValue ?? {};
});

export const ISPData = (ip: string): ISPInfo => ({
    name: ipData[ip],
    color: "#6495ed"
});

export const format = (data: ISPInfo): Nullable<string> => data.name ?? null;

export default {
    ISPData,
    format
};
