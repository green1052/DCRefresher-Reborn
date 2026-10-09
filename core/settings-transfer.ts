/**
 * 설정 옮기기: 클라우드 복원·합치기, JSON 가져오기, 초기화가 저장소에 쓰는 규칙. 옵션 페이지의 데이터 탭이 쓴다.
 * 키는 storage.local의 이름(local: 없이)이다. 백업·내보내기와 같은 모양이다.
 */
import {isBackupTarget, readBackupTargets} from "@/core/backup";
import {BLOCK_DEFAULTS_KEY, BLOCK_TYPES, blockListKey, isBlockListKey, MODULES_KEY, rawKey, settingsKeyModule} from "@/core/storage/items";
import type {BlockEntry, BlockType, DetectMode} from "@/core/storage/types";
import {blockKey, normalizeBlockList, normalizeDefaults} from "@/stores/blocks";
import {isRecord} from "@/utils/record";

const DEFAULTS_KEY = rawKey(BLOCK_DEFAULTS_KEY);
const MODULES = rawKey(MODULES_KEY);
/** 차단 목록 키 (local: 없이) → 유형. */
const BLOCK_LIST_TYPES = new Map<string, BlockType>(BLOCK_TYPES.map((type) => [rawKey(blockListKey(type)), type]));

/** 값 여러 개를 객체 하나에 담는 키(모듈 on/off, 기본 차단 모드, 모듈별 설정). */
const isMapKey = (key: string): boolean =>
    key === MODULES || key === DEFAULTS_KEY || settingsKeyModule(key) !== undefined;

/**
 * 다른 기기에서 온 차단 항목의 검사 방식을 지킨다. 모드가 '기본값'(없음)인 항목은 그 기기의 기본 모드(from)로 검사됐으므로,
 * 이 기기의 기본 모드(local)와 다르면 그 모드를 항목에 적는다. 같으면 그대로 둔다.
 */
export const pinDefaultMode = (list: BlockEntry[], from: DetectMode, local: DetectMode): BlockEntry[] =>
    from === local ? list : list.map((entry) => (entry.mode ? entry : {...entry, mode: from}));

/**
 * 설정(백업 대상 키)을 저장소에 쓴다. IP/밴 DB·백업 상태·모듈 캐시는 건드리지 않는다.
 * - replace(클라우드 복원·초기화): 백업은 완전한 스냅숏이므로 거기 없는 설정 키는 지운다.
 * - merge(가져오기): 붙여넣은 JSON은 일부만 담을 수 있으므로 든 키만 쓴다. 설정만 든 JSON이 차단/메모 목록을 지우지 않게 한다.
 *   설정 객체(isMapKey)도 기존 값에 얕게 합쳐, 설정 몇 개만 든 JSON이 나머지 설정을 기본값으로 돌리지 않게 한다.
 * 쓰다가 실패하면 이전 값으로 되돌린다.
 */
export const writeSettings = async (data: Record<string, unknown>, mode: "replace" | "merge"): Promise<void> => {
    // 아래에서 쓰는 이전 값(기본 차단 모드·설정 객체·지울 키·되돌릴 키)은 모두 백업 대상 키다.
    const previous = await readBackupTargets();
    // 설정 키가 아닌 값(차단/메모 내보내기의 "NICK" 등)과 없는 모듈의 설정은 저장하지 않는다.
    const next = Object.fromEntries(Object.entries(data).filter(([key]) => isBackupTarget(key)));
    // 백업·내보내기는 용량 때문에 차단 항목 id를 빼므로 저장할 때 다시 붙인다.
    for (const [key, value] of Object.entries(next)) {
        if (isBlockListKey(key)) next[key] = normalizeBlockList(value);
    }
    if (mode === "merge") {
        // 기본 차단 모드는 mergeBackup처럼 이 기기 것을 남기고, 가져온 목록의 모드 없는 항목에 JSON의 기본 모드를 적어 둔다.
        // JSON에 기본 모드가 없으면 그 기기는 기본값을 썼다. 이 기기 기본 모드를 따르게 두면 가져온 'ㅋ'이 일치 검사가 되는 등 검사 방식이 바뀐다.
        const localDefaults = normalizeDefaults(previous[DEFAULTS_KEY]);
        const importDefaults = normalizeDefaults(next[DEFAULTS_KEY]);
        delete next[DEFAULTS_KEY];
        for (const type of BLOCK_TYPES) {
            const key = rawKey(blockListKey(type));
            if (key in next) next[key] = pinDefaultMode(next[key] as BlockEntry[], importDefaults[type], localDefaults[type]);
        }
        for (const [key, value] of Object.entries(next)) {
            const old = previous[key];
            if (isMapKey(key) && isRecord(old) && isRecord(value)) next[key] = {...old, ...value};
        }
    }
    // 거르고 나서 남은 키가 없으면(가져온 JSON에 기본 차단 모드만 든 경우 등)
    // 복원은 모든 설정을 지우고 가져오기는 아무것도 쓰지 않으므로 실패로 알린다. 설정을 비우는 것은 초기화({})만 허용한다.
    if (Object.keys(data).length > 0 && Object.keys(next).length === 0) throw new Error("쓸 수 있는 설정이 없습니다.");
    const removed = mode === "replace" ? Object.keys(previous).filter((key) => isBackupTarget(key) && !(key in next)) : [];

    try {
        await browser.storage.local.remove(removed);
        await browser.storage.local.set(next);
    } catch (e) {
        // 건드린 키만 되돌린다. 저장소 전체를 다시 쓰면 그사이 다른 탭이 한 쓰기(차단 추가, DB 갱신)를 지운다.
        // 되돌리기도 실패할 수 있다(용량이 꽉 참). 그때는 되돌리기 실패를 덮어 쓴 원래 실패를 알린다.
        const touched = [...removed, ...Object.keys(next)];
        try {
            await browser.storage.local.remove(touched.filter((key) => !(key in previous)));
            await browser.storage.local.set(Object.fromEntries(touched.filter((key) => key in previous).map((key) => [key, previous[key]])));
        } catch (rollback) {
            console.error("설정 되돌리기 실패:", rollback);
        }
        throw e;
    }
};

/**
 * 백업을 지금 데이터에 합친다. 겹치면 지금 것이 이긴다.
 * 차단 목록은 백업에만 있는 항목(내용+갤러리)을 뒤에 붙이고, 메모·설정 객체는 백업에만 있는 키를 더한다. 그 밖의 값은 지금 없을 때만 백업 값을 쓴다.
 */
export const mergeBackup = (current: Record<string, unknown>, backup: Record<string, unknown>): Record<string, unknown> => {
    // 모드 없는 차단 항목은 유형의 기본 모드를 따른다. 기본 모드는 이 기기 것을 남기고, 백업의 기본 모드가 다른 유형은
    // 백업에서 온 항목에 그 모드를 적어 둔다. 어느 한쪽 기본 모드만 남으면 다른 쪽 항목의 검사 방식이 바뀐다('ㅋ'이 포함 검사가 되는 등).
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
    // 기본 모드는 백업에 없어도 이 기기 것을 넘긴다. 없으면 writeSettings가 기본값을 쓴 기기의 JSON으로 보고 이 기기 항목에까지 모드를 적는다.
    return {...merged, [DEFAULTS_KEY]: localDefaults};
};

/** 붙여 넣은 설정 JSON. 설정 키(refresher:…)가 하나도 없으면 잘못 붙여 넣은 것으로 보고 던진다. */
export const parseImport = (input: string): Record<string, unknown> => {
    const parsed: unknown = JSON.parse(input);
    if (!isRecord(parsed)) throw new Error("가져오기 데이터는 JSON 객체여야 합니다.");
    // 차단/메모 내보내기나 {}를 붙여넣으면 아무것도 쓰지 않고 "가져왔습니다"만 뜨므로 잘못 붙여넣었다고 알린다.
    if (!Object.keys(parsed).some((key) => key.startsWith("refresher:"))) {
        throw new Error("설정 데이터가 아닙니다.");
    }
    return parsed;
};
