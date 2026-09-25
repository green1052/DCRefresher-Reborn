import type {BlockEntry, BlockType, DetectMode} from "@/core/storage/types";
import {useBlocksStore} from "@/stores/blocks";

interface Compiled {
    regex: RegExp;
    /** 첫 매치 == 전체로 보면 `닉1|닉1a`처럼 앞 대안이 짧게 매치할 때 완전 일치를 놓친다 — 전체를 앵커로 감싼 것 */
    anchored: RegExp;
}

// 항목별 컴파일 캐시 — 스토어는 항목이 바뀌면 객체를 새로 만드므로 객체를 키로 쓰면 목록 크기와 상관없이 한 번만 컴파일한다 (잘못된 패턴은 null)
const regexCache = new WeakMap<BlockEntry, Compiled | null>();

const compile = (entry: BlockEntry): Compiled | null => {
    let compiled = regexCache.get(entry);
    if (compiled === undefined) {
        try {
            compiled = {regex: new RegExp(entry.content), anchored: new RegExp(`^(?:${entry.content})$`)};
        } catch {
            compiled = null;
        }
        regexCache.set(entry, compiled);
    }
    return compiled;
};

const matches = (entry: BlockEntry, mode: DetectMode, content: string): boolean => {
    if (entry.isRegex) {
        const compiled = compile(entry);
        if (!compiled) return false;

        switch (mode) {
            case "SAME":
                return compiled.anchored.test(content);
            case "CONTAIN":
                return compiled.regex.test(content);
            case "NOT_SAME":
                return !compiled.anchored.test(content);
            case "NOT_CONTAIN":
                return !compiled.regex.test(content);
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
