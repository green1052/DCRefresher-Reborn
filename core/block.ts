import {LRUCache} from "lru-cache";

import type {BlockEntry, BlockType, DetectMode} from "@/core/storage/types";
import {useBlocksStore} from "@/stores/blocks";

// 정규식 컴파일 캐시 (차단 목록이 바뀌어도 같은 패턴은 재사용)
const regexCache = new LRUCache<string, RegExp | false>({max: 500});

const compile = (pattern: string): RegExp | null => {
    let regex = regexCache.get(pattern);
    if (regex === undefined) {
        try {
            regex = new RegExp(pattern);
        } catch {
            regex = false;
        }
        regexCache.set(pattern, regex);
    }
    return regex || null;
};

const matches = (entry: BlockEntry, mode: DetectMode, content: string): boolean => {
    if (entry.isRegex) {
        const regex = compile(entry.content);
        if (!regex) return false;

        switch (mode) {
            // 첫 매치 == 전체로 보면 `닉1|닉1a`처럼 앞 대안이 짧게 매치할 때 완전 일치를 놓친다 — 전체를 앵커로 감싸 본다
            case "SAME":
                return compile(`^(?:${entry.content})$`)?.test(content) === true;
            case "CONTAIN":
                return regex.test(content);
            case "NOT_SAME":
                return compile(`^(?:${entry.content})$`)?.test(content) === false;
            case "NOT_CONTAIN":
                return !regex.test(content);
        }
    }

    switch (mode) {
        case "SAME":
            return entry.content === content;
        case "CONTAIN":
            return content.includes(entry.content);
        case "NOT_SAME":
            return entry.content !== content;
        case "NOT_CONTAIN":
            return !content.includes(entry.content);
    }
};

/** 해당 내용이 차단 대상인지 (갤러리 한정 항목은 그 갤러리에서만) */
export const isBlocked = (type: BlockType, content: string, gallery?: string): boolean => {
    if (!content) return false;

    const {entries, defaults} = useBlocksStore.getState();
    return entries[type].some(
        (entry) => (!entry.gallery || entry.gallery === gallery) && matches(entry, entry.mode ?? defaults[type], content)
    );
};

/** 값 중 하나라도 차단 대상인지 */
export const isAnyBlocked = (values: Partial<Record<BlockType, string | null | undefined>>, gallery?: string): boolean =>
    Object.entries(values).some(([type, value]) => value && isBlocked(type as BlockType, value, gallery));
