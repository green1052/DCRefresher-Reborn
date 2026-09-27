import {objectEntries} from "ts-extras";

import type {BlockEntry, BlockType, DetectMode} from "@/core/storage/types";
import {useBlocksStore} from "@/stores/blocks";

interface Compiled {
    regex: RegExp;
    /**
     * 완전 일치 검사용 ^(?:패턴)$. 첫 매치가 전체와 같은지로 보면 `닉1|닉1a`에서 앞 대안이 짧게 먼저 매치해
     * `닉1a`의 완전 일치를 놓친다.
     */
    anchored: RegExp;
}

// 항목 객체 → 컴파일 결과 (잘못된 패턴은 null). 스토어는 항목이 바뀌면 새 객체를 만들므로 따로 무효화할 필요가 없다.
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

// NOT_*는 SAME/CONTAIN을 뒤집은 것. 잘못된 정규식은 NOT_*로도 걸지 않는다
const matches = (entry: BlockEntry, mode: DetectMode, content: string): boolean => {
    const whole = mode.endsWith("SAME");
    let hit: boolean;

    if (entry.isRegex) {
        const compiled = compile(entry);
        if (!compiled) return false;
        hit = (whole ? compiled.anchored : compiled.regex).test(content);
    } else {
        hit = whole ? entry.content === content : content.includes(entry.content);
    }

    return mode.startsWith("NOT_") ? !hit : hit;
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
    objectEntries(values).some(([type, value]) => value && isBlocked(type, value, gallery));

/**
 * 같은 댓글 묶기 (도배 접기). 공백만 다른 글도 같게 보고, minLength보다 짧은 글(ㅋㅋ 등)과 count번 미만 반복은 건너뛴다.
 * 묶인 항목만 돌려준다. 값은 첫 항목이 반복 수, 나머지는 0이다.
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
 * 값에 걸린 차단 항목들 (유저 버블의 "걸린 차단 규칙").
 * React에서는 구독한 목록을 lists로 넘긴다. 기본값(getState)에 맡기면 React Compiler가 인자만 보고 이전 결과를 재사용해
 * 차단 목록이 바뀌어도 다시 계산하지 않는다.
 */
export const blockingEntries = (values: BlockValues, gallery?: string, lists: BlockLists = useBlocksStore.getState()): { type: BlockType; entry: BlockEntry }[] =>
    objectEntries(values).flatMap(([type, value]) =>
        value ? lists.entries[type].filter((entry) => applies(lists, type, entry, value, gallery)).map((entry) => ({type, entry})) : []
    );
