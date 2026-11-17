/** 차단 목록 값의 검사, 정규화. core에서 stores를 불러오면 React가 배경 번들에 딸려 간다. */
import {BLOCK_TYPES, DEFAULT_DETECT_MODE, DETECT_MODE_NAMES, DETECT_MODES} from "@/core/storage/items";
import type {BlockEntry, BlockType, DetectMode} from "@/core/storage/types";
import {isRecord} from "@/utils/record";
import {arrayIncludes} from "@/utils/typed";

export type BlockInputFields = Omit<BlockEntry, "id">;

const isBlockEntry = (value: unknown): value is Omit<BlockEntry, "id"> & { id?: unknown } =>
    isRecord(value) &&
    // 빈 내용은 포함 검사에서 모든 글에 맞는다. 다이얼로그는 막지만 가져오기, 옛 데이터로 들어올 수 있다.
    typeof value.content === "string" &&
    value.content.trim() !== "" &&
    typeof value.isRegex === "boolean" &&
    (value.gallery === undefined || typeof value.gallery === "string") &&
    (value.extra === undefined || typeof value.extra === "string") &&
    (value.mode === undefined || arrayIncludes(DETECT_MODES, value.mode));

/** 항목 플래그 표시 ([정규식] [갤러리: X] [모드명] 순). */
export const composeExtra = (fields: { isRegex: boolean; gallery?: string; mode?: DetectMode }): string =>
    [
        fields.isRegex ? "[정규식]" : "",
        fields.gallery ? `[갤러리: ${fields.gallery}]` : "",
        fields.mode ? `[${DETECT_MODE_NAMES[fields.mode]}]` : ""
    ]
        .filter(Boolean)
        .join(" ");

/** 같은 content+gallery는 한 항목이다. */
export const blockKey = ({content, gallery}: BlockInputFields): string => JSON.stringify([content, gallery ?? ""]);

/** 유효한 항목만 남기고 id가 없거나 겹치면 새로 준다. known은 content+gallery로 옛 id를 잇는 목록. */
export const normalizeBlockList = (value: unknown, known: BlockEntry[] = []): BlockEntry[] => {
    if (!Array.isArray(value)) return [];

    const knownIds = new Map(known.map((entry) => [blockKey(entry), entry.id]));
    const ids = new Set<string>();
    return value.filter(isBlockEntry).map((entry) => {
        const given = typeof entry.id === "string" ? entry.id : knownIds.get(blockKey(entry));
        const id = given !== undefined && !ids.has(given) ? given : crypto.randomUUID();
        ids.add(id);
        // 옛 항목은 플래그 문자열을 extra에 넣었다. 필드에서 만드니 버린다.
        return entry.extra && entry.extra === composeExtra(entry) ? {...entry, id, extra: undefined} : {...entry, id};
    });
};

/** 기본 차단 모드. 검증 없이 들어오는 모르는 모드는 버린다. */
export const normalizeDefaults = (value: unknown): Record<BlockType, DetectMode> => {
    const defaults = {...DEFAULT_DETECT_MODE};
    if (!isRecord(value)) return defaults;
    for (const type of BLOCK_TYPES) {
        const mode = value[type];
        if (arrayIncludes(DETECT_MODES, mode)) defaults[type] = mode;
    }
    return defaults;
};
