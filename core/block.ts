import type {BlockEntry, BlockType, DetectMode} from "@/core/storage/types";
import {useBlocksStore} from "@/stores/blocks";
import {objectEntries} from "@/utils/typed";

interface Compiled {
    regex: RegExp;
    /**
     * 완전 일치 검사용 ^(?:패턴)$. 첫 매치가 전체와 같은지로 보면 `닉1|닉1a`에서 앞 대안이 짧게 먼저 매치해
     * `닉1a`의 완전 일치를 놓친다
     */
    anchored: RegExp;
}

// 항목 객체 → 컴파일 결과 (잘못된 패턴은 null). 스토어는 항목이 바뀌면 새 객체를 만들므로 따로 무효화할 필요가 없다
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

/** 일치·포함 검사. NOT_*도 뒤집지 않고 SAME/CONTAIN으로 본다. 잘못된 정규식은 맞지 않는다 */
const matches = (entry: BlockEntry, mode: DetectMode, content: string): boolean => {
    const whole = mode.endsWith("SAME");
    if (!entry.isRegex) return whole ? entry.content === content : content.includes(entry.content);

    const compiled = compile(entry);
    return compiled !== null && (whole ? compiled.anchored : compiled.regex).test(content);
};

type BlockLists = Pick<ReturnType<typeof useBlocksStore.getState>, "entries" | "defaults">;
type BlockValues = Partial<Record<BlockType, string | null | undefined>>;

/**
 * 내용에 걸린 항목들 (갤러리 한정 항목은 그 갤러리에서만). SAME/CONTAIN은 맞는 항목마다 막는다.
 * NOT_*(불일치·불포함)는 한 유형의 항목을 묶어 허용 목록으로 본다: 어느 것에도 맞지 않으면 그 항목들 전부로 막는다.
 * 항목마다 뒤집으면 둘만 돼도 서로를 막아(A는 B와 다르다) 모두 막힌다. 잘못된 정규식은 NOT_*로도 걸지 않는다
 */
const blockingIn = (lists: BlockLists, type: BlockType, content: string, gallery?: string): BlockEntry[] => {
    const hits: BlockEntry[] = [];
    const allowList: BlockEntry[] = [];
    let allowed = false;

    for (const entry of lists.entries[type]) {
        if (entry.gallery && entry.gallery !== gallery) continue;

        const mode = entry.mode ?? lists.defaults[type];
        const hit = matches(entry, mode, content);
        if (!mode.startsWith("NOT_")) {
            if (hit) hits.push(entry);
        } else if (!entry.isRegex || compile(entry)) {
            allowList.push(entry);
            allowed ||= hit;
        }
    }

    return allowed ? hits : [...hits, ...allowList];
};

/**
 * 디시콘 요소의 코드 (이미지 URL의 no 파라미터). 페이지 차단 필터, 우클릭 선택, 미리보기가 같은 기준을 써야 선택해서 넣은 항목이 실제로 가려진다.
 * src 없이 data-src나 <source>만 가진 video 디시콘이 있고, 빈 src 속성도 건너뛰어야 해서 ||를 쓴다
 */
export const dcconCode = (element: HTMLElement): string | undefined => {
    const media = (element as HTMLImageElement).src ? element : (element.querySelector("img, video, source") ?? element);
    const src = media.getAttribute("src") || media.getAttribute("data-src");
    return src ? URL.parse(src, location.href)?.searchParams.get("no") || undefined : undefined;
};

/** 해당 내용이 차단 대상인지 (갤러리 한정 항목은 그 갤러리에서만) */
export const isBlocked = (type: BlockType, content: string, gallery?: string): boolean =>
    content !== "" && blockingIn(useBlocksStore.getState(), type, content, gallery).length > 0;

/** 값 중 하나라도 차단 대상인지 */
export const isAnyBlocked = (values: BlockValues, gallery?: string): boolean =>
    objectEntries(values).some(([type, value]) => value && isBlocked(type, value, gallery));

/** 본문 차단 안내 문구. 페이지(block 모듈)와 미리보기(창·미니)가 같이 쓴다 */
export const BLOCKED_TEXT = "게시글 내용이 차단되었습니다.";

/**
 * 같은 댓글 묶기 (도배 접기). 공백만 다른 글도 같게 보고, minLength보다 짧은 글(ㅋㅋ 등)과 count번 미만 반복은 건너뛴다.
 * 묶인 항목만 돌려준다. 값은 첫 항목이 반복 수, 나머지는 0이다
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
 * 차단 목록이 바뀌어도 다시 계산하지 않는다
 */
export const blockingEntries = (values: BlockValues, gallery?: string, lists: BlockLists = useBlocksStore.getState()): { type: BlockType; entry: BlockEntry }[] =>
    objectEntries(values).flatMap(([type, value]) =>
        value ? blockingIn(lists, type, value, gallery).map((entry) => ({type, entry})) : []
    );
