import type {ModuleSettings} from "@/core/module/types";
import type {BlockEntry, BlockType, DetectMode} from "@/core/storage/types";
import {useBlocksStore} from "@/stores/blocks";
import {objectEntries} from "@/utils/typed";

interface Compiled {
    regex: RegExp;
    /** 완전 일치용 ^(?:패턴)$ - 앞 대안이 짧게 먼저 맞으면 전체 일치를 놓친다. */
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

/** IP 포함 검사용: 이스케이프에 숫자 경계를 붙여 "1.2.3.4"가 "11.2.3.45"를 잡지 않게 한다. */
const ipPatternCache = new WeakMap<BlockEntry, RegExp>();
const ipPattern = (entry: BlockEntry): RegExp => {
    let pattern = ipPatternCache.get(entry);
    if (!pattern) {
        // 항목 끝이 숫자일 때만 그쪽 경계를 붙여 "1.2.3."처럼 점으로 끝나는 접두사 항목도 그대로 쓰게 한다.
        const lead = /^\d/.test(entry.content) ? "(?<![0-9])" : "";
        const trail = /\d$/.test(entry.content) ? "(?![0-9])" : "";
        pattern = new RegExp(`${lead}${RegExp.escape(entry.content)}${trail}`);
        ipPatternCache.set(entry, pattern);
    }
    return pattern;
};

/** NOT_*도 뒤집지 않고 SAME/CONTAIN으로 본다. */
const matches = (entry: BlockEntry, mode: DetectMode, content: string, type: BlockType): boolean => {
    const whole = mode.endsWith("SAME");
    if (!entry.isRegex) {
        if (whole) return entry.content === content;
        if (type === "IP") return ipPattern(entry).test(content);
        return content.includes(entry.content);
    }

    const compiled = compile(entry);
    return compiled !== null && (whole ? compiled.anchored : compiled.regex).test(content);
};

type BlockLists = Pick<ReturnType<typeof useBlocksStore.getState>, "entries" | "defaults">;
type BlockValues = Partial<Record<BlockType, string | null | undefined>>;

interface Index {
    /** 만들 때의 기본 모드. 바뀌면 모드 없는 항목이 일치 항목인지가 달라져 다시 만든다. */
    defaultMode: DetectMode;
    /** 정규식 아닌 SAME 항목: 내용 → 항목들 (수천 개를 하나씩 비교하지 않게). */
    exact: Map<string, BlockEntry[]>;
    /** 나머지 (CONTAIN, NOT_*, 정규식). */
    rest: BlockEntry[];
}

// 유형의 항목 배열 → 색인. 스토어는 목록이 바뀌면 그 유형의 배열을 새로 만드므로 바뀐 유형만 다시 만든다.
const indexes = new WeakMap<BlockEntry[], Index>();

const indexFor = (lists: BlockLists, type: BlockType): Index => {
    const entries = lists.entries[type];
    const defaultMode = lists.defaults[type];
    let index = indexes.get(entries);
    if (index?.defaultMode !== defaultMode) {
        const isExact = (entry: BlockEntry): boolean => !entry.isRegex && (entry.mode ?? defaultMode) === "SAME";
        index = {defaultMode, exact: Map.groupBy(entries.filter(isExact), (entry) => entry.content), rest: entries.filter((entry) => !isExact(entry))};
        indexes.set(entries, index);
    }
    return index;
};

/** 한 유형의 항목으로 막히는지. NOT_*는 묶어 허용 목록이라 어느 것도 안 맞으면 그 전부로 막는다. */
const scan = (lists: BlockLists, type: BlockType, content: string, gallery: string | undefined, onEntry?: (entry: BlockEntry, kind: "hit" | "allow" | "miss") => void): boolean => {
    const {exact, rest} = indexFor(lists, type);
    let blocked = false;
    let hasAllowList = false;
    let allowed = false;

    for (const entry of exact.get(content) ?? []) {
        if (entry.gallery && entry.gallery !== gallery) continue;
        blocked = true;
        onEntry?.(entry, "hit");
    }

    for (const entry of rest) {
        if (entry.gallery && entry.gallery !== gallery) continue;

        const mode = entry.mode ?? lists.defaults[type];
        if (!mode.startsWith("NOT_")) {
            if (!matches(entry, mode, content, type)) continue;
            blocked = true;
            onEntry?.(entry, "hit");
        } else if (!entry.isRegex || compile(entry)) {
            hasAllowList = true;
            const hit = matches(entry, mode, content, type);
            allowed ||= hit;
            onEntry?.(entry, hit ? "allow" : "miss");
        }
    }

    return blocked || (hasAllowList && !allowed);
};

/** 막은 항목들: 걸린 SAME/CONTAIN과, 허용 목록에 안 맞았으면 NOT_* 전부. */
const blockingIn = (lists: BlockLists, type: BlockType, content: string, gallery?: string): BlockEntry[] => {
    const hits = new Set<BlockEntry>();
    const allowList: BlockEntry[] = [];
    let allowed = false;
    scan(lists, type, content, gallery, (entry, kind) => {
        if (kind === "hit") hits.add(entry);
        else allowList.push(entry);
        allowed ||= kind === "allow";
    });
    // 유저 버블에는 목록 순서대로 보이게 다시 걸러낸다.
    const blocking = lists.entries[type].filter((entry) => hits.has(entry));
    return allowed ? blocking : [...blocking, ...allowList];
};

/** 디시콘 코드(미디어 URL의 no 파라미터). data-src나 <source>만 가진 video가 있어 ||로 찾는다. */
export const dcconCode = (element: HTMLElement): string | undefined => {
    const media = element.getAttribute("src") ? element : (element.querySelector("img, video, source") ?? element);
    const src = media.getAttribute("src") || media.getAttribute("data-src");
    return src ? URL.parse(src, location.href)?.searchParams.get("no") || undefined : undefined;
};

export const blockMode = (settings: ModuleSettings["block"]): "blur" | "hide" => (settings.blur ? "blur" : "hide");

/** data-blocked로 가려진 요소인지. reveal 계열 속성이 있으면 안 가린 것으로 본다. */
export const isBlockedHidden = (element: Element): boolean => {
    const blocked = element.closest("[data-blocked]");
    if (!blocked || element.closest("[data-block-revealed], [data-comments-revealed]")) return false;
    return !(blocked.getAttribute("data-blocked") === "blur" && element.closest("[data-blur-reveal]"));
};

/** 내용이 차단 대상인지. */
export const isBlocked = (type: BlockType, content: string, gallery?: string): boolean =>
    content !== "" && scan(useBlocksStore.getState(), type, content, gallery);

/** 값 중 하나라도 차단 대상인지. */
export const isAnyBlocked = (values: BlockValues, gallery?: string): boolean =>
    objectEntries(values).map(([type, value]) => (value ? isBlocked(type, value, gallery) : false)).some(Boolean);

/** 확장이 흐리게 가린 행 (차단 블러, userinfo의 깡계 흐림). 흐린 행은 보이므로 checkVisibility로 가릴 수 없다. */
export const BLURRED_ROW_SELECTOR = ".refresherBlur, .refresherLowActivityBlur";

/** 확장이 가린 행 (차단, 깡계). 클래스는 assets/styles/content.css가 그린다. */
export const HIDDEN_ROW_SELECTOR = `.refresherBlocked, .refresherLowActivityHide, ${BLURRED_ROW_SELECTOR}`;

/** userinfo가 깡계 상태를 바꿨을 때 보내는 이벤트. 차단 모듈이 같은 댓글을 다시 접는다. */
export const ROWS_HIDDEN_EVENT = "refresher:rowsHidden";

/** 본문 차단 안내 문구 (페이지, 미리보기 공용). */
export const BLOCKED_TEXT = "게시글 내용이 차단되었습니다.";

/** 같은 댓글 접기 기준. 끄면 null이다. */
export const duplicateOf = (settings: ModuleSettings["block"]): { count: number; minLength: number } | null =>
    settings.foldDuplicate ? {count: settings.duplicateCount, minLength: settings.duplicateMinLength} : null;

/** 같은 댓글 묶기. 공백만 다른 글도 같게 본다. 값은 첫 항목이 반복 수, 나머지는 0. */
export const groupDuplicates = <T>(items: T[], textOf: (item: T) => string, {count, minLength}: { count: number; minLength: number }): Map<T, number> => {
    const result = new Map<T, number>();

    for (const [text, group] of Map.groupBy(items, (item) => textOf(item).replace(/\s+/g, " ").trim())) {
        if (text.length < minLength || group.length < count) continue;
        for (const [index, item] of group.entries()) result.set(item, index === 0 ? group.length : 0);
    }

    return result;
};

/** 값에 걸린 차단 항목들. 컴포넌트는 구독한 목록을 넘겨 다시 그리게 한다. */
export const blockingEntries = (values: BlockValues, gallery?: string, lists: BlockLists = useBlocksStore.getState()): { type: BlockType; entry: BlockEntry }[] =>
    objectEntries(values).flatMap(([type, value]) =>
        value ? blockingIn(lists, type, value, gallery).map((entry) => ({type, entry})) : []
    );
