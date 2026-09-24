import {dbStorage} from "@/core/storage/items";

let ipData: Record<string, string> = {};

void (async () => {
    ipData = (await dbStorage.getValue()).ip;
})();

dbStorage.watch((next) => {
    if (next) ipData = next.ip;
});

export interface IPData {
    name: string | undefined;
    color: string;
}

/** IP → ISP 데이터. 색은 고정 (v5: #6495ed) */
export const ISPData = (ip: string): IPData => ({
    name: ipData[ip],
    color: "#6495ed"
});

export const format = (data: IPData): string | null => data.name ?? null;
