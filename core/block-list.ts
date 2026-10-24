/**
 * 차단 목록 값의 검사·정규화. zustand 스토어(stores/blocks.ts) 없이 core(설정 옮기기 등)에서도 쓴다 —
 * core에서 stores를 불러오면 zustand의 React 바인딩이 Preact를 배경 번들에 딸려 보낸다 (entrypoints/background/blocks.ts).
 */
import {BLOCK_TYPES, DEFAULT_DETECT_MODE, DETECT_MODE_NAMES, DETECT_MODES} from "@/core/storage/items";
import type {BlockEntry, BlockType, DetectMode} from "@/core/storage/types";
import {isRecord} from "@/utils/record";
import {arrayIncludes} from "@/utils/typed";

export type BlockInputFields = Omit<BlockEntry, "id">;

/** 비슷한 이미지 지문 (utils/imageFingerprint.ts). */
const FINGERPRINT = /^[0-9a-f]{32}$/;
/** 움짤 항목의 나머지 장면 지문 수의 상한. 지금은 3개를 넣는다. 백업 용량을 지키려고 막는다. */
const MAX_FRAMES = 8;

const isBlockEntry = (value: unknown): value is Omit<BlockEntry, "id"> & { id?: unknown } =>
    isRecord(value) &&
    // 빈 내용은 포함 검사에서 모든 글에 맞는다. 다이얼로그는 막지만 가져오기·옛 데이터로 들어올 수 있다.
    typeof value.content === "string" &&
    value.content.trim() !== "" &&
    typeof value.isRegex === "boolean" &&
    (value.gallery === undefined || typeof value.gallery === "string") &&
    (value.extra === undefined || typeof value.extra === "string") &&
    (value.similar === undefined || (typeof value.similar === "string" && FINGERPRINT.test(value.similar))) &&
    (value.frames === undefined || (Array.isArray(value.frames) && value.frames.length <= MAX_FRAMES &&
                                    value.frames.every((frame) => typeof frame === "string" && FINGERPRINT.test(frame)))) &&
    (value.mode === undefined || arrayIncludes(DETECT_MODES, value.mode));

/** 항목의 플래그 표시 ([정규식] [갤러리: X] [모드명] 순). extra(별명)와 따로 필드에서 만든다. */
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

/**
 * 저장소·가져오기 값에서 유효한 항목만 남긴다. id가 없거나 겹치면 새로 준다 (겹친 id는 삭제·수정이 그 항목 모두에 걸린다).
 * known: id 없는 항목(백업·내보내기는 id를 뺀다)이 같은 content+gallery 항목의 id를 이어받을 목록. 새 id면 그 항목의 사용 기록(core/usage.ts)이 사라진다.
 */
export const normalizeBlockList = (value: unknown, known: BlockEntry[] = []): BlockEntry[] => {
    if (!Array.isArray(value)) return [];

    const knownIds = new Map(known.map((entry) => [blockKey(entry), entry.id]));
    const ids = new Set<string>();
    return value.filter(isBlockEntry).map((entry) => {
        const given = typeof entry.id === "string" ? entry.id : knownIds.get(blockKey(entry));
        const id = given !== undefined && !ids.has(given) ? given : crypto.randomUUID();
        ids.add(id);
        // 예전 항목(v5, 이전 다이얼로그)은 플래그 문자열을 extra에 넣었다. 표시할 때 필드에서 만드니 버린다.
        return entry.extra && entry.extra === composeExtra(entry) ? {...entry, id, extra: undefined} : {...entry, id};
    });
};

/** 저장소·백업의 기본 차단 모드. 가져오기·복원 값은 검증 없이 들어오므로 모르는 모드(소문자 등)는 버리고 그 유형은 기본 모드로 둔다. */
export const normalizeDefaults = (value: unknown): Record<BlockType, DetectMode> => {
    const defaults = {...DEFAULT_DETECT_MODE};
    if (!isRecord(value)) return defaults;
    for (const type of BLOCK_TYPES) {
        const mode = value[type];
        if (arrayIncludes(DETECT_MODES, mode)) defaults[type] = mode;
    }
    return defaults;
};
