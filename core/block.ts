import ky from "ky";
import pLimit from "p-limit";
import QuickLRU from "quick-lru";

import type {ImageHashes} from "@/core/messaging/protocol";
import type {ModuleSettings} from "@/core/module/types";
import type {BlockEntry, BlockType, DetectMode} from "@/core/storage/types";
import {markUsed} from "@/core/usage";
import {useBlocksStore} from "@/stores/blocks";
import {sha256} from "@/utils/hash";
import {imageFingerprints, isSimilarSet, MAX_PIXELS, type Sample} from "@/utils/imageFingerprint";
import {isWholeMp4} from "@/utils/mp4";
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

/** 이미지 차단이 보는 디시 본문 이미지(viewimage.php). */
const VIEW_IMAGE = /^https:\/\/[^/]+\.dcinside\.(?:com|co\.kr)\/viewimage\.php/;

/** 한 주소를 읽은 것. 파일 해시가 지문보다 먼저 나와 같은 파일은 먼저 막는다. */
interface ImageRead {
    file: Promise<string | undefined>;
    hashes: Promise<ImageHashes | undefined>;
    /** 지문까지 구하는 읽기인지. */
    similar: boolean;
}

// 주소 → 읽은 것. 읽지 못한 것도 남겨 둔다(지우면 판정마다 다시 요청한다). 오래된 것부터 버린다.
const imageReads = new QuickLRU<string, ImageRead>({maxSize: 250});

// 열린 탭이 한꺼번에 다시 판정할 때 요청이 몰리지 않게 한다.
const fetchLimit = pLimit(4);

/** onFile은 파일 해시를 구하자마자 부른다. */
const readImageHashes = async (url: string, similar: boolean, onFile: (file: string) => void): Promise<ImageHashes | undefined> => {
    try {
        // 파이어폭스 콘텐츠 스크립트 요청은 Referer가 없어 디시가 403을 준다.
        // 바이트는 이 콜백 안에서만 쓴다. 밖에 두면 사본 한 벌이 남는다.
        const {file, hash} = await fetchLimit(async () => {
            // 파이어폭스의 http는 content.fetch라 CORS에 걸려 기본 ky로 받는다.
            const request = ky.get(url, {cache: "force-cache", referrer: location.href, retry: 0, timeout: false, totalTimeout: 60_000});
            const response = await request;
            const file = await request.blob();
            const bytes = await file.arrayBuffer();
            // 크롬은 구간 캐시로 206을 준다. 전체를 담았을 때만 받는다.
            if (response.status !== 200 && !(response.status === 206 && isWholeMp4(new Uint8Array(bytes)))) throw new Error(`HTTP ${response.status}`);
            return {file, hash: await sha256(bytes)};
        });
        onFile(hash);
        return {file: hash, similar: similar ? (await imageFingerprints(file)) ?? null : undefined};
    } catch (e) {
        console.warn("Image hash failed:", url, e);
        return undefined;
    }
};

const readImage = async (url: string, {retry = false, similar = false}: { retry?: boolean; similar?: boolean }): Promise<ImageRead> => {
    const cached = imageReads.get(url);
    // 지문을 기다리지 않고 돌려준다. 같은 파일은 파일 해시로 먼저 막는다.
    if (cached && !retry && (cached.similar || !similar)) return cached;
    // 곧바로 등록한다. 같은 주소를 여럿이 판정해도 한 번만 받게.
    const previous = cached ? await cached.hashes : undefined;
    // 지문 없이 읽어 둔 것은 지문이 필요해지면 다시 읽는다 (비슷한 이미지 설정을 켰을 때). 읽지 못한 것은 retry일 때만 다시 읽는다.
    if (cached && (previous ? !similar || previous.similar !== undefined : !retry)) return cached;
    // 다른 호출이 이미 다시 읽기 시작했으면 그것을 쓴다.
    if (cached && imageReads.get(url) !== cached) return readImage(url, {similar});
    const file = Promise.withResolvers<string | undefined>();
    // 다시 읽다 실패하면 앞서 구한 파일 해시를 지킨다.
    const hashes = readImageHashes(url, similar, file.resolve).then((next) => next ?? previous);
    // 파일 해시를 못 알렸으면 다 끝난 것으로 푼다.
    void hashes.then((done) => file.resolve(done?.file));
    const read = {file: file.promise, hashes, similar};
    imageReads.set(url, read);
    return read;
};

/** 이미지 SHA-256과 similar면 지문. 배경이 이 요청에 CORS 헤더를 붙인다. */
export const imageHash = async (url: string, options: { retry?: boolean; similar?: boolean } = {}): Promise<ImageHashes | undefined> =>
    (await readImage(url, options)).hashes;

/** 움짤 주소 → 짝 주소. 디시는 mp4/gif를 바꿔 보여 한쪽 해시로는 다른 쪽을 못 막는다. */
// 판정마다 다시 적어 밀려나지 않게 넉넉히 둔다.
const mediaPairs = new QuickLRU<string, string>({maxSize: 500});

export const pairedMediaUrl = (url: string): string | undefined => mediaPairs.get(url);

const rememberPair = (video: HTMLVideoElement): void => {
    const gif = video.dataset.src ? URL.parse(video.dataset.src, location.href)?.href : undefined;
    // mp4를 받다 오류가 나면 currentSrc가 비고, 디시가 곧바로 gif로 바꾼다. <source>의 주소는 처음부터 있다.
    const mp4 = video.currentSrc || video.querySelector("source")?.src;
    if (!gif || !mp4 || gif === mp4) return;
    mediaPairs.set(mp4, gif);
    mediaPairs.set(gif, mp4);
};

export const blockMode = (settings: ModuleSettings["block"]): "blur" | "hide" => (settings.blur ? "blur" : "hide");

export const similarImageThreshold = (settings: ModuleSettings["block"]): number | undefined =>
    settings.similarImages ? settings.similarThreshold : undefined;

// 표본 → 지난 판정. 움짤은 반복 재생마다 다시 보므로 목록, 모드, 갤러리, 기준이 같으면 다시 훑지 않는다.
const similarHits = new WeakMap<Sample[], { entries: BlockEntry[]; mode: DetectMode; gallery: string | undefined; threshold: number; hits: BlockEntry[] }>();

/** 비슷한 이미지 항목에 걸리는지. NOT_*는 허용 목록이라 여기서 보지 않는다. */
const isSimilarBlocked = (samples: Sample[], gallery: string | undefined, threshold: number): boolean => {
    const {entries, defaults} = useBlocksStore.getState();
    let last = similarHits.get(samples);
    if (last?.entries !== entries.IMAGE || last.mode !== defaults.IMAGE || last.gallery !== gallery || last.threshold !== threshold) {
        const hits: BlockEntry[] = [];
        for (const entry of entries.IMAGE) {
            if (!entry.similar || (entry.gallery && entry.gallery !== gallery) || (entry.mode ?? defaults.IMAGE).startsWith("NOT_")) continue;
            if (isSimilarSet(samples, [entry.similar, ...(entry.frames ?? [])], threshold)) hits.push(entry);
        }
        last = {entries: entries.IMAGE, mode: defaults.IMAGE, gallery, threshold, hits};
        similarHits.set(samples, last);
    }
    for (const entry of last.hits) markUsed("block", entry.id);
    return last.hits.length > 0;
};

/** 움짤을 다시 볼 이벤트. 파이어폭스는 progress/suspend 없이 끝나 반복 재생 때 다시 본다. */
export const VIDEO_CHECK_EVENTS = ["progress", "suspend", "canplaythrough", "seeked"];

/** 다 받은 미디어의 화소 수. 부분 받은 것을 읽으면 확장이 나머지를 다시 받는다. */
const loadedPixels = (media: HTMLImageElement | HTMLVideoElement): number | undefined => {
    if (media instanceof HTMLImageElement) return media.complete && media.naturalWidth > 0 ? media.naturalWidth * media.naturalHeight : undefined;
    const {buffered, duration} = media;
    const whole = media.readyState === HTMLMediaElement.HAVE_ENOUGH_DATA && buffered.length === 1 && buffered.start(0) === 0 && buffered.end(0) >= duration - 0.05;
    return whole ? media.videoWidth * media.videoHeight : undefined;
};

/** 차단 목록(IMAGE)에 든 파일인지. similar를 주면 비슷한 이미지도 막는다. */
export const isImageBlocked = async (media: HTMLImageElement | HTMLVideoElement, gallery?: string, similar?: number): Promise<boolean> => {
    const url = media.currentSrc;
    if (media instanceof HTMLVideoElement) rememberPair(media);
    const entries = useBlocksStore.getState().entries.IMAGE;
    const pixels = loadedPixels(media);
    if (!VIEW_IMAGE.test(url) || pixels === undefined || entries.length === 0) return false;
    // 지문이 있는 항목이 없거나 너무 큰 이미지면 지문을 구하지 않는다. 디코딩이 해시보다 훨씬 무겁다.
    const fingerprintable = pixels <= MAX_PIXELS && entries.some((entry) => entry.similar);
    const threshold = fingerprintable ? similar : undefined;
    const read = await readImage(url, {similar: threshold !== undefined});
    // 지문은 늦어질 수 있어 같은 파일은 파일 해시가 나오자마자 막는다.
    const file = await read.file;
    if (!file) return false;
    // isBlocked가 NOT_* 항목(허용 목록)까지 판정한다.
    const exact = isBlocked("IMAGE", file, gallery);
    if (threshold === undefined) return exact;
    // 같은 파일이어도 비슷한 이미지 항목을 마저 봐서 걸린 항목을 모두 쓰였다고 적는다.
    const near = read.hashes.then((hashes) => !!hashes?.similar && isSimilarBlocked(hashes.similar, gallery, threshold));
    // exact면 near를 기다리지 않으니 그 거부는 여기서 받아 둔다.
    void near.catch(() => {});
    return exact || near;
};

/** data-blocked로 가려진 요소인지. reveal 계열 속성이 있으면 안 가린 것으로 본다. */
export const isBlockedHidden = (element: Element): boolean => {
    const blocked = element.closest("[data-blocked]");
    if (!blocked || element.closest("[data-block-revealed], [data-comments-revealed]")) return false;
    return !(blocked.getAttribute("data-blocked") === "blur" && element.closest("[data-blur-reveal]"));
};

/** 내용이 차단 대상인지. 맞은 항목은 모두 쓰였다고 적는다(같이 막은 항목이 지워지지 않게). */
export const isBlocked = (type: BlockType, content: string, gallery?: string): boolean =>
    content !== "" && scan(useBlocksStore.getState(), type, content, gallery, (entry, kind) => {
        if (kind !== "miss") markUsed("block", entry.id);
    });

/** 값 중 하나라도 차단 대상인지. */
export const isAnyBlocked = (values: BlockValues, gallery?: string): boolean =>
    // some을 바로 쓰면 다른 유형 항목의 markUsed가 빠진다.
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
