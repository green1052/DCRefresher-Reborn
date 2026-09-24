import {dbStorage} from "@/core/storage/items";

// ban: Record<이유, 유저ID[]> — 빠른 조회를 위해 uid → 이유[] 역색인 유지
let reverseIndex = new Map<string, string[]>();

const rebuild = (ban: Record<string, string[]>): void => {
    const next = new Map<string, string[]>();

    for (const [reason, uids] of Object.entries(ban)) {
        for (const uid of uids) {
            const reasons = next.get(uid);
            if (reasons) reasons.push(reason);
            else next.set(uid, [reason]);
        }
    }

    reverseIndex = next;
};

void (async () => {
    rebuild((await dbStorage.getValue()).ban);
})();

dbStorage.watch((next) => {
    if (next) rebuild(next.ban);
});

/** 유저의 갱신 차단(밴) 이유들. 없으면 null */
export const getBan = (uid: string): string | null => {
    const reasons = reverseIndex.get(uid);
    return reasons?.length ? reasons.join(", ") : null;
};
