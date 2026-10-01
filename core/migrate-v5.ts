/**
 * v5 → v6 저장소 마이그레이션. 한시적이다: v5 사용자가 충분히 넘어오면 이 파일과 호출부를 지운다.
 *
 * v5는 모듈 이름(한글)으로 키를 나눠 저장했다:
 *   refresher:module:<이름>:enable            → refresher:modules[<id>]
 *   refresher:module:<이름>:setting:<키>      → refresher:module:<id>:settings[<키>]
 *   refresher:block:<유형>:mode              → refresher:block:defaults[<유형>]
 * 차단·메모 목록(refresher:block:<유형>, refresher:memo:<유형>)은 키와 모양이 같아 그대로 쓴다.
 * 옛 IP DB(refresher:database:*)·모듈 캐시(…:data)·백업 시각은 버린다. 다시 받거나 새로 쌓인다.
 * 5.1.2 이전 버전이 남긴 키(isLeftoverKey)도 버린다. v5도 읽지 않던 잔재라 백업·내보내기만 불린다.
 * 설정 키·값 형식은 v5와 같다(모듈별로 대조함). v6에 없는 키는 v6가 읽지 않으니 그대로 넘겨도 된다.
 */
import {arrayIncludes} from "ts-extras";

import {BLOCK_DEFAULTS_KEY, BLOCK_TYPES, blockListKey, DETECT_MODES, MODULES_KEY, moduleSettingsKey, rawKey} from "@/core/storage/items";
import type {BlockType, DetectMode} from "@/core/storage/types";
import {isRecord} from "@/utils/record";

const V5_MODULE_IDS: Record<string, string> = {
    "컨텐츠 차단": "block",
    "미리보기": "preview",
    "글 목록 새로고침": "refresh",
    "관리": "manage",
    "유저 정보": "userinfo",
    "레이아웃 수정": "layout",
    "폰트 교체": "fonts",
    "스텔스 모드": "stealth",
    "이미지 검색": "imagesearch",
    "글쓰기": "write"
};

/** v5 관리 모듈에 있던 설정 중 v6 유저 정보로 옮겨진 것 */
const MOVED_TO_USERINFO = ["checkRatio", "alarmRatio", "checkPermBan"];
/** 위 중 v5에서 관리 모듈이 켜져 있어야만 동작하던 켜기/끄기 설정 */
const NEEDS_MANAGE_ENABLED = ["checkRatio", "checkPermBan"];

const V5_KEY = /^refresher:module:(.+):(enable|data|setting:(.+))$/;

type Snapshot = Record<string, unknown>;

/** 5.1.2 이전 버전의 키 (옛 DB 수백 KB, 모듈 데이터, v4 모듈·설정 스냅숏). 옮겨진 뒤에도 지워지지 않아 클라우드 백업 한도를 넘긴다 */
const isLeftoverKey = (key: string): boolean =>
    key.startsWith("refresher.database.") ||
    key.startsWith("refresher.module:") ||
    key === "__REFRESHER_MODULES" ||
    key === "__REFRESHER_SETTINGS" ||
    key === "refresher:settings";

/** v5가 쓴 키 (잔재 키 제외) */
const isV5Key = (key: string): boolean =>
    (V5_KEY.exec(key)?.[1] ?? "") in V5_MODULE_IDS || /^refresher:block:[A-Z]+:mode$/.test(key) || key.startsWith("refresher:database:");

/** 옮기거나 버릴 키가 하나라도 있는지 */
const hasV5Data = (data: Snapshot): boolean => Object.keys(data).some((key) => isV5Key(key) || isLeftoverKey(key));

/** JSON 문자열이면 풀고, 아니면(이미 값이거나 깨졌으면) 그대로 둔다 */
const parseStored = (value: unknown): unknown => {
    if (typeof value !== "string") return value;
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
};

/**
 * 저장소 스냅숏 → v6 스냅숏. v5 키는 빠지고, 옮긴 값은 이미 있는 v6 값을 덮어쓰지 않는다.
 * v5 키가 없으면 그대로 돌려준다.
 */
export const migrateV5 = (data: Snapshot): Snapshot => {
    if (!hasV5Data(data)) return data;

    const next: Snapshot = {};
    const enables: Record<string, boolean> = {};
    const settings: Record<string, Record<string, unknown>> = {};
    const defaults: Partial<Record<BlockType, DetectMode>> = {};
    const manageEnabled = data["refresher:module:관리:enable"] === true;

    for (const [key, value] of Object.entries(data)) {
        const match = V5_KEY.exec(key);
        const id = match ? V5_MODULE_IDS[match[1]!] : undefined;

        if (match && id !== undefined) {
            if (match[2] === "data" || value === null || value === undefined) continue;

            if (match[2] === "enable") {
                if (typeof value === "boolean") enables[id] = value;
                continue;
            }

            const setting = match[3]!;
            if (id === "manage" && MOVED_TO_USERINFO.includes(setting)) {
                (settings.userinfo ??= {})[setting] = NEEDS_MANAGE_ENABLED.includes(setting) ? value === true && manageEnabled : value;
            } else {
                (settings[id] ??= {})[setting] = value;
            }
            continue;
        }

        const mode = /^refresher:block:([A-Z]+):mode$/.exec(key);
        if (mode) {
            const type = mode[1];
            // v5 초기 버전은 값을 JSON 문자열("\"SAME\"")로 저장하기도 했다
            const modeValue = parseStored(value);
            if (arrayIncludes(BLOCK_TYPES, type) && arrayIncludes(DETECT_MODES, modeValue)) defaults[type] = modeValue;
            continue;
        }

        // v5 초기 버전은 차단·메모 목록도 JSON 문자열로 저장하기도 했다 (v5.0.2가 읽을 때 풀었다).
        // 풀지 않으면 v6가 빈 목록으로 읽고, 다음에 목록을 저장할 때 지워진다
        if (/^refresher:(block|memo):[A-Z]+$/.test(key)) {
            next[key] = parseStored(value);
            continue;
        }

        if (key.startsWith("refresher:database:") || key === "refresher:backup:lastUpdate" || isLeftoverKey(key)) continue;

        next[key] = value;
    }

    // v5는 모든 유형의 기본 모드가 SAME이었다. :mode 키가 없는 유형에 v6 기본값(제목·내용·댓글은 CONTAIN)을 쓰면
    // 'ㅋ' 같은 항목이 포함 검사가 되어 마구 막으므로, 차단 목록이 있는 유형은 SAME으로 고정한다.
    // 차단 목록 키는 v5·v6가 같으니 v5 키가 있을 때만 v5 데이터로 본다 (잔재 키만 있는 개발 빌드의 v6 데이터는 제외).
    const fromV5 = Object.keys(data).some(isV5Key);
    for (const type of fromV5 ? BLOCK_TYPES : []) {
        if (rawKey(blockListKey(type)) in data) defaults[type] ??= "SAME";
    }

    // 옛 버전은 refresher:modules에 v4 모듈 스냅숏(객체)을 넣어 두었다. on/off(boolean) 값만 남긴다
    const modules = next[rawKey(MODULES_KEY)];
    if (isRecord(modules)) next[rawKey(MODULES_KEY)] = Object.fromEntries(Object.entries(modules).filter(([, value]) => typeof value === "boolean"));

    // 이미 있는 v6 값이 이긴다
    const merge = (key: string, fromV5: Record<string, unknown>): void => {
        if (Object.keys(fromV5).length === 0) return;
        next[key] = {...fromV5, ...(isRecord(next[key]) ? next[key] : {})};
    };

    merge(rawKey(MODULES_KEY), enables);
    merge(rawKey(BLOCK_DEFAULTS_KEY), defaults);
    for (const [id, values] of Object.entries(settings)) merge(rawKey(moduleSettingsKey(id)), values);

    return next;
};

/** 로컬 저장소에 적용 (설치·업데이트 때). 바뀐 게 없으면 아무것도 하지 않는다 */
export const migrateV5Storage = async (): Promise<void> => {
    const current = await browser.storage.local.get(null);
    if (!hasV5Data(current)) return;

    const next = migrateV5(current);
    const removed = Object.keys(current).filter((key) => !(key in next));
    const changed = Object.fromEntries(Object.entries(next).filter(([key, value]) => JSON.stringify(current[key]) !== JSON.stringify(value)));

    await browser.storage.local.set(changed);
    await browser.storage.local.remove(removed);
};
