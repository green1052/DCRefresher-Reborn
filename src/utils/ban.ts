import {databaseStorage} from "@/storage/wxtStorage";

let banReverseIndex: Map<string, string[]> = new Map();

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

void (async () => {
    banReverseIndex = buildBanReverseIndex(await databaseStorage.ban.getValue());

    // 백그라운드가 주기적으로 DB를 갱신하므로 열려 있는 탭도 따라가야 한다.
    databaseStorage.ban.watch((newValue) => {
        banReverseIndex = buildBanReverseIndex(newValue ?? {});
    });
})();

export const getBan = (userId: string): string | null => {
    const bannedFrom = banReverseIndex.get(userId);
    if (!bannedFrom || bannedFrom.length === 0) return null;
    return bannedFrom.join(", ");
};

export const getBanReverseIndex = (): Map<string, string[]> => banReverseIndex;

export default {
    getBan,
    getBanReverseIndex,
    buildBanReverseIndex
};
