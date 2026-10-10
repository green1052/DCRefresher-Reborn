import type {ModuleSettings} from "@/core/module/types";
import type {BlockEntry, BlockType, DetectMode} from "@/core/storage/types";
import {markUsed} from "@/core/usage";
import {useBlocksStore} from "@/stores/blocks";
import {objectEntries} from "@/utils/typed";

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

/** 일치·포함 검사. NOT_*도 뒤집지 않고 SAME/CONTAIN으로 본다. 잘못된 정규식은 맞지 않는다. */
const matches = (entry: BlockEntry, mode: DetectMode, content: string): boolean => {
    const whole = mode.endsWith("SAME");
    if (!entry.isRegex) return whole ? entry.content === content : content.includes(entry.content);

    const compiled = compile(entry);
    return compiled !== null && (whole ? compiled.anchored : compiled.regex).test(content);
};

type BlockLists = Pick<ReturnType<typeof useBlocksStore.getState>, "entries" | "defaults">;
type BlockValues = Partial<Record<BlockType, string | null | undefined>>;

interface Index {
    /** 만들 때의 기본 모드. 바뀌면 모드 없는 항목이 일치 항목인지가 달라져 다시 만든다. */
    defaultMode: DetectMode;
    /** 정규식이 아닌 SAME 항목: 내용 → 항목들. 가져오기로 수천 개 넣은 닉네임·아이디를 하나씩 비교하지 않고 찾는다. */
    exact: Map<string, BlockEntry[]>;
    /** 나머지 항목 (CONTAIN·NOT_*·정규식). 목록 순서대로 하나씩 본다. */
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

/**
 * 한 유형의 항목으로 내용이 막히는지 판정한다 (갤러리 한정 항목은 그 갤러리에서만). SAME/CONTAIN은 맞는 항목마다 막는다.
 * NOT_*(불일치·불포함)는 한 유형의 항목을 묶어 허용 목록으로 본다: 어느 것에도 맞지 않으면 그 항목들 전부로 막는다.
 * 항목마다 뒤집으면 둘만 돼도 서로를 막아(A는 B와 다르다) 모두 막힌다. 잘못된 정규식은 NOT_*로도 걸지 않는다.
 * onEntry: 맞은 SAME/CONTAIN("hit"), 맞은 NOT_*("allow"), 맞지 않은 NOT_*("miss"). 목록 행·댓글마다 불리므로 판정만 할 때는 배열을 만들지 않는다.
 * 정규식이 아닌 SAME 항목은 색인에서 찾아 먼저 넘기고, 나머지는 목록 순서대로 본다.
 */
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
            if (!matches(entry, mode, content)) continue;
            blocked = true;
            onEntry?.(entry, "hit");
        } else if (!entry.isRegex || compile(entry)) {
            hasAllowList = true;
            const hit = matches(entry, mode, content);
            allowed ||= hit;
            onEntry?.(entry, hit ? "allow" : "miss");
        }
    }

    return blocked || (hasAllowList && !allowed);
};

/** 내용을 막은 항목들: 걸린 SAME/CONTAIN과, 허용 목록에 맞지 않았으면 그 NOT_* 항목 전부. */
const blockingIn = (lists: BlockLists, type: BlockType, content: string, gallery?: string): BlockEntry[] => {
    const hits = new Set<BlockEntry>();
    const allowList: BlockEntry[] = [];
    let allowed = false;
    scan(lists, type, content, gallery, (entry, kind) => {
        if (kind === "hit") hits.add(entry);
        else allowList.push(entry);
        allowed ||= kind === "allow";
    });
    // scan은 색인에서 찾은 SAME 항목을 먼저 넘긴다. 유저 버블에는 걸린 항목을 목록 순서대로 보인다.
    const blocking = lists.entries[type].filter((entry) => hits.has(entry));
    return allowed ? blocking : [...blocking, ...allowList];
};

/**
 * 디시콘 요소의 코드 (이미지 URL의 no 파라미터). 페이지 차단 필터, 우클릭 선택, 미리보기가 같은 기준을 써야 선택해서 넣은 항목이 실제로 가려진다.
 * src 없이 data-src나 <source>만 가진 video 디시콘이 있고, 빈 src 속성도 건너뛰어야 해서 ||를 쓴다.
 */
export const dcconCode = (element: HTMLElement): string | undefined => {
    const media = (element as HTMLImageElement).src ? element : (element.querySelector("img, video, source") ?? element);
    const src = media.getAttribute("src") || media.getAttribute("data-src");
    return src ? URL.parse(src, location.href)?.searchParams.get("no") || undefined : undefined;
};

/**
 * 차단 표시(data-blocked)로 가려진 요소인지. '가린 내용 보기'(data-block-revealed) 중이거나
 * 흐림 차단을 흐림 풀기(data-blur-reveal)로 밝힌 동안은 가려지지 않은 것으로 본다.
 * 미리보기의 큰 이미지(Frame)와 디시콘 정보 창(openDcconInfo)이 같은 기준을 쓴다.
 */
export const isBlockedHidden = (element: Element): boolean => {
    const blocked = element.closest("[data-blocked]");
    if (!blocked || element.closest("[data-block-revealed]")) return false;
    return !(blocked.getAttribute("data-blocked") === "blur" && element.closest("[data-blur-reveal]"));
};

/**
 * 막히는지 판정하고, 맞은 항목(막은 SAME/CONTAIN, 허용한 NOT_*)은 모두 쓰였다고 적는다 (옵션의 오래 안 쓰인 항목 거르기).
 * 첫 항목에서 멈추면 같은 대상을 함께 막는 다른 항목(닉네임과 아이디로 같이 막은 유저 등)이 안 쓰인 것으로 보여 지워질 수 있다.
 */
const isBlockedIn = (lists: BlockLists, type: BlockType, content: string, gallery?: string): boolean =>
    scan(lists, type, content, gallery, (entry, kind) => {
        if (kind !== "miss") markUsed("block", entry.id);
    });

/** 해당 내용이 차단 대상인지 (갤러리 한정 항목은 그 갤러리에서만). */
export const isBlocked = (type: BlockType, content: string, gallery?: string): boolean =>
    content !== "" && isBlockedIn(useBlocksStore.getState(), type, content, gallery);

/** 값 중 하나라도 차단 대상인지. 막힌 유형에서 멈추지 않고 모든 유형을 본다. */
export const isAnyBlocked = (values: BlockValues, gallery?: string): boolean =>
    // some을 바로 쓰면 첫 막힌 유형에서 멈춰 다른 유형 항목(같은 유저를 아이디로도 막은 것 등)의 markUsed가 빠진다.
    objectEntries(values).map(([type, value]) => Boolean(value) && isBlocked(type, value!, gallery)).some(Boolean);

/** 확장이 흐리게 가린 행 (차단 블러, userinfo의 깡계 흐림). 흐린 행은 보이므로 checkVisibility로 가릴 수 없다. */
export const BLURRED_ROW_SELECTOR = ".refresherBlur, .refresherLowActivityBlur";

/**
 * 확장이 가린 행 (차단 숨김·블러, userinfo의 깡계 숨김·흐림). 같은 댓글 접기는 이 안의 댓글을 세지 않는다.
 * 클래스는 assets/styles/content.css가 그린다.
 */
export const HIDDEN_ROW_SELECTOR = `.refresherBlocked, .refresherLowActivityHide, ${BLURRED_ROW_SELECTOR}`;

/** userinfo가 깡계 숨김·흐림을 이미 그려진 행에서 바꿨을 때 document에 보내는 이벤트. 차단 모듈이 받아 같은 댓글을 다시 접는다. */
export const ROWS_HIDDEN_EVENT = "refresher:rowsHidden";

/** 본문 차단 안내 문구. 페이지(block 모듈)와 미리보기(창·미니)가 같이 쓴다. */
export const BLOCKED_TEXT = "게시글 내용이 차단되었습니다.";

/** 차단 모듈 설정의 같은 댓글 접기 기준. 끄면 null이다. 페이지(차단 모듈)와 미리보기가 같이 쓴다. */
export const duplicateOf = (settings: ModuleSettings["block"]): { count: number; minLength: number } | null =>
    settings.foldDuplicate ? {count: settings.duplicateCount, minLength: settings.duplicateMinLength} : null;

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
 * React에서는 구독한 목록을 lists로 넘긴다. 기본값(getState)은 구독하지 않아
 * 차단 목록이 바뀌어도 다시 그리지 않는다.
 */
export const blockingEntries = (values: BlockValues, gallery?: string, lists: BlockLists = useBlocksStore.getState()): { type: BlockType; entry: BlockEntry }[] =>
    objectEntries(values).flatMap(([type, value]) =>
        value ? blockingIn(lists, type, value, gallery).map((entry) => ({type, entry})) : []
    );
