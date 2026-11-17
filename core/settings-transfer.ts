/** 클라우드 복원, 합치기, JSON 가져오기, 초기화가 저장소에 쓰는 규칙 (옵션 데이터 탭). */
import {isBackupTarget, readBackupTargets} from "@/core/backup";
import {blockKey, normalizeBlockList, normalizeDefaults} from "@/core/block-list";
import {BLOCK_DEFAULTS_KEY, BLOCK_TYPES, backupStorage, blockListKey, isBlockListKey, LIST_LOCKS, MODULES_KEY, rawKey, settingsKeyModule} from "@/core/storage/items";
import type {BlockEntry, BlockType, DetectMode} from "@/core/storage/types";
import {isRecord} from "@/utils/record";

const DEFAULTS_KEY = rawKey(BLOCK_DEFAULTS_KEY);
const MODULES = rawKey(MODULES_KEY);
/** 차단 목록 키 (local: 없이) → 유형. */
const BLOCK_LIST_TYPES = new Map<string, BlockType>(BLOCK_TYPES.map((type) => [rawKey(blockListKey(type)), type]));

/** 값 여러 개를 객체 하나에 담는 키(모듈 on/off, 기본 차단 모드, 모듈별 설정). */
const isMapKey = (key: string): boolean =>
    key === MODULES || key === DEFAULTS_KEY || settingsKeyModule(key) !== undefined;

/** 다른 기기 항목의 검사 방식 유지 - 모드 없는 항목은 그 기기의 기본 모드(from)를 적는다. */
export const pinDefaultMode = (list: BlockEntry[], from: DetectMode, local: DetectMode): BlockEntry[] =>
    from === local ? list : list.map((entry) => (entry.mode ? entry : {...entry, mode: from}));

/** 설정을 저장소에 쓴다. replace는 스냅숏이라 없는 키를 지우고, merge는 든 키만 얕게 합친다. 이전 값을 undo에 남긴다. */
/** 스토어 쓰기와 같은 잠금을 모두 잡아 옵션 출처 안에서 한 줄로 세운다. */
const withListLocks = <T>(run: () => Promise<T>): Promise<T> => {
    const locks = navigator.locks;
    return locks.request(LIST_LOCKS.blocks, () => locks.request(LIST_LOCKS.memos, () => locks.request(LIST_LOCKS.moduleSettings, run)));
};

export const writeSettings = async (data: Record<string, unknown>, mode: "replace" | "merge"): Promise<number | undefined> => withListLocks(async () => {
    // 아래에서 쓰는 이전 값(기본 차단 모드, 설정 객체, 지울 키, 되돌릴 키)은 백업 대상 키다.
    const previous = await readBackupTargets();
    if (mode === "replace") {
        // 없어진 모듈의 설정은 백업 대상이 아니지만 replace에서는 지운다. 되돌릴 수 있게 값도 읽어 둔다.
        const leftovers = (await browser.storage.local.getKeys()).filter((key) => settingsKeyModule(key) !== undefined && !isBackupTarget(key));
        if (leftovers.length > 0) Object.assign(previous, await browser.storage.local.get(leftovers));
    }
    // 설정 키가 아닌 값(차단/메모 내보내기의 "NICK" 등)과 없는 모듈의 설정은 저장하지 않는다.
    const next = Object.fromEntries(Object.entries(data).filter(([key]) => isBackupTarget(key)));
    // merge는 기본 차단 모드를 이 기기 것으로 남기고, 가져온 모드 없는 항목에 JSON의 기본 모드를 적는다.
    const localDefaults = normalizeDefaults(previous[DEFAULTS_KEY]);
    const importDefaults = normalizeDefaults(next[DEFAULTS_KEY]);
    // 차단 항목 id는 백업에서 빠지므로 저장할 때 다시 붙인다. JSON에 없는 목록은 만들지 않는다(merge가 비우지 않게).
    for (const [key, type] of BLOCK_LIST_TYPES) {
        if (!(key in next)) continue;
        const list = normalizeBlockList(next[key], normalizeBlockList(previous[key]));
        next[key] = mode === "merge" ? pinDefaultMode(list, importDefaults[type], localDefaults[type]) : list;
    }
    if (mode === "merge") {
        delete next[DEFAULTS_KEY];
        for (const [key, value] of Object.entries(next)) {
            const old = previous[key];
            if (isMapKey(key) && isRecord(old) && isRecord(value)) next[key] = {...old, ...value};
        }
    }
    // 남은 키가 없으면 실패로 알린다 - 설정을 비우는 것은 초기화({})만 허용한다.
    if (Object.keys(data).length > 0 && Object.keys(next).length === 0) throw new Error("쓸 수 있는 설정이 없습니다.");
    const removed = mode === "replace" ? Object.keys(previous).filter((key) => !(key in next)) : [];

    try {
        await browser.storage.local.remove(removed);
        await browser.storage.local.set(next);
    } catch (e) {
        // 건드린 키만 되돌린다 - 전체를 다시 쓰면 그사이 다른 탭의 쓰기를 지운다.
        const touched = [...removed, ...Object.keys(next)];
        try {
            await browser.storage.local.remove(touched.filter((key) => !(key in previous)));
            await browser.storage.local.set(Object.fromEntries(touched.filter((key) => key in previous).map((key) => [key, previous[key]])));
        } catch (e) {
            console.error("설정 되돌리기 실패:", e);
        }
        throw e;
    }
    // refresher:backup:* 키라 자동 백업을 깨우지 않는다. 남기지 못해도 쓰기는 이미 끝났으므로 실패로 알리지 않는다.
    const createdAt = Date.now();
    try {
        await backupStorage.undo().setValue({data: previous, createdAt});
        return createdAt;
    } catch (e) {
        console.error(e);
    }
    return undefined;
});

/** 백업을 지금 데이터에 합친다. 겹치면 지금 것이 이기고, 목록은 백업에만 있는 항목을 뒤에 붙인다. */
export const mergeBackup = (current: Record<string, unknown>, backup: Record<string, unknown>): Record<string, unknown> => {
    // 기본 모드는 이 기기 것을 남기고, 백업에서 온 모드 없는 항목에는 백업의 기본 모드를 적는다 (pinDefaultMode).
    const localDefaults = normalizeDefaults(current[DEFAULTS_KEY]);
    const backupDefaults = normalizeDefaults(backup[DEFAULTS_KEY]);
    const merged = Object.fromEntries(Object.entries(backup).map(([key, value]) => {
        const local = current[key];
        if (isBlockListKey(key)) {
            const type = BLOCK_LIST_TYPES.get(key);
            const kept = normalizeBlockList(local);
            const seen = new Set(kept.map(blockKey));
            const added = normalizeBlockList(value).filter((entry) => !seen.has(blockKey(entry)));
            return [key, [...kept, ...(type ? pinDefaultMode(added, backupDefaults[type], localDefaults[type]) : added)]];
        }
        if (local === undefined) return [key, value];
        return [key, isRecord(local) && isRecord(value) ? {...value, ...local} : local];
    }));
    // 기본 모드는 백업에 없어도 이 기기 것을 넘긴다 - 없으면 writeSettings가 기본값 쓴 기기의 JSON으로 보고 이 기기 항목에까지 모드를 적는다.
    return {...merged, [DEFAULTS_KEY]: localDefaults};
};

/** 붙여 넣은 설정 JSON. 설정 키(refresher:...)가 하나도 없으면 잘못 붙여 넣은 것으로 보고 던진다. v5 데이터도 던진다. */
export const parseImport = (input: string): Record<string, unknown> => {
    const parsed: unknown = JSON.parse(input);
    if (!isRecord(parsed)) throw new Error("가져오기 데이터는 JSON 객체여야 합니다.");
    // 차단/메모 내보내기나 {}를 붙여넣으면 아무것도 쓰지 않고 "가져왔습니다"만 뜨므로 잘못 붙여넣었다고 알린다.
    if (!Object.keys(parsed).some((key) => key.startsWith("refresher:"))) {
        throw new Error("설정 데이터가 아닙니다.");
    }
    // v5는 키가 조용히 빠지거나 목록을 비우는데도 성공으로 보여 막는다.
    const isV5 = Object.entries(parsed).some(([key, value]) =>
        /^refresher:(module:.+:(enable|setting:.+)|block:[A-Z]+:mode)$/.test(key) ||
        (/^refresher:(block|memo):[A-Z]+$/.test(key) && typeof value === "string"));
    if (isV5) throw new Error("v5 데이터는 가져올 수 없습니다.");
    // 값 형태가 정해진 키에 다른 형태가 오면 목록, 메모, 설정을 지우므로 가져오기를 막는다.
    for (const [key, value] of Object.entries(parsed)) {
        if (isBlockListKey(key) && !Array.isArray(value)) throw new Error(`설정 값의 형태가 올바르지 않습니다: ${key}`);
        if ((key.startsWith("refresher:memo:") || isMapKey(key)) && !isRecord(value)) throw new Error(`설정 값의 형태가 올바르지 않습니다: ${key}`);
    }
    return parsed;
};
