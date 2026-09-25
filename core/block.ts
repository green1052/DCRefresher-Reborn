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

type BlockLists = Pick<ReturnType<typeof useBlocksStore.getState>, "entries" | "defaults">;
type BlockValues = Partial<Record<BlockType, string | null | undefined>>;

const applies = (lists: BlockLists, type: BlockType, entry: BlockEntry, content: string, gallery?: string): boolean =>
    (!entry.gallery || entry.gallery === gallery) && matches(entry, entry.mode ?? lists.defaults[type], content);

/** 해당 내용이 차단 대상인지 (갤러리 한정 항목은 그 갤러리에서만) */
export const isBlocked = (type: BlockType, content: string, gallery?: string): boolean => {
    if (!content) return false;

    const lists = useBlocksStore.getState();
    return lists.entries[type].some((entry) => applies(lists, type, entry, content, gallery));
};

/** 값 중 하나라도 차단 대상인지 */
export const isAnyBlocked = (values: BlockValues, gallery?: string): boolean =>
    Object.entries(values).some(([type, value]) => value && isBlocked(type as BlockType, value, gallery));

/**
 * 같은 댓글 묶기 (도배 접기). 공백만 다른 글도 같게 보고, minLength보다 짧은 글(ㅋㅋ 등)과 count번 미만 반복은 건너뛴다.
 * 묶인 것만 담아 돌려준다 — 첫 댓글은 반복 수, 나머지는 0
 */
export const groupDuplicates = <T>(items: T[], textOf: (item: T) => string, {count, minLength}: { count: number; minLength: number }): Map<T, number> => {
    const result = new Map<T, number>();

    for (const [text, group] of Map.groupBy(items, (item) => textOf(item).replace(/\s+/g, " ").trim())) {
        if (text.length < minLength || group.length < count) continue;
        for (const [index, item] of group.entries()) result.set(item, index === 0 ? group.length : 0);
    }

    return result;
};

/**
 * 값을 차단한 항목들 (유저 버블의 "걸린 차단 규칙"). React에서는 구독한 목록을 lists로 넘겨야
 * 목록이 바뀔 때 다시 계산된다 (getState로 읽으면 React Compiler가 이전 결과를 그대로 쓴다)
 */
export const blockingEntries = (values: BlockValues, gallery?: string, lists: BlockLists = useBlocksStore.getState()): { type: BlockType; entry: BlockEntry }[] =>
    Object.entries(values).flatMap(([type, value]) =>
        value ? lists.entries[type as BlockType].filter((entry) => applies(lists, type as BlockType, entry, value, gallery)).map((entry) => ({type: type as BlockType, entry})) : []
    );
