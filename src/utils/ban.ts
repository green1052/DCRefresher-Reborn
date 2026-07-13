import {databaseStorage} from "@/storage/wxtStorage";

let banData: Record<string, string[]> = {};
let banReverseIndex: Map<string, string[]> = new Map();
let banDataReady: Promise<void> | null = null;

export const buildBanReverseIndex = (ban: Record<string, string[]>): Map<string, string[]> => {
    const index = new Map<string, string[]>();
    for (const [reason, userIds] of Object.entries(ban)) {
        for (const userId of userIds) {
            const existing = index.get(userId);
            if (existing) {
                existing.push(reason);
            } else {
                index.set(userId, [reason]);
            }
        }
    }
    return index;
};

const initBanData = (): Promise<void> => {
    if (!banDataReady) {
        banDataReady = (async () => {
            banData = await databaseStorage.ban.getValue();
            banReverseIndex = buildBanReverseIndex(banData);
        })();
    }
    return banDataReady;
};

void initBanData();

export const getBan = (userId: string): string | null => {
    const bannedFrom = banReverseIndex.get(userId);
    if (!bannedFrom || bannedFrom.length === 0) return null;
    return bannedFrom.join(", ");
};

export const getBanReverseIndex = (): Map<string, string[]> => banReverseIndex;

export const ensureBanDataReady = (): Promise<void> => initBanData();

export default {
    getBan,
    getBanReverseIndex,
    buildBanReverseIndex,
    ensureBanDataReady
};