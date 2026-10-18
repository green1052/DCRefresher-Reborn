import ky from "ky";
import pLimit from "p-limit";
import QuickLRU from "quick-lru";

import {type ImageHashes, sendMessage} from "@/core/messaging/protocol";
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
 * 항목마다 뒤집으면 둘만 돼도 서로를 막아 모두 막힌다. 잘못된 정규식은 NOT_*로도 걸지 않는다.
 * onEntry: 맞은 SAME/CONTAIN("hit"), 맞은 NOT_*("allow"), 맞지 않은 NOT_*("miss"). 목록 행·댓글마다 불리므로 판정만 할 때는 배열을 만들지 않는다.
 * 정규식이 아닌 SAME 항목은 색인에서 찾아 먼저 넘긴다.
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

/** 이미지 차단이 보는 디시 본문 이미지(viewimage.php). 디시콘(dccon.php)·외부 이미지는 보지 않는다. */
const VIEW_IMAGE = /^https:\/\/[^/]+\.dcinside\.(?:com|co\.kr)\/viewimage\.php/;

/** 한 주소를 읽은 것. 파일 해시(file)는 지문(hashes.similar)보다 먼저 나와, 같은 파일은 지문을 기다리지 않고 막는다 (isImageBlocked). */
interface ImageRead {
    file: Promise<string | undefined>;
    hashes: Promise<ImageHashes | undefined>;
    /** 지문까지 구하는 읽기인지. */
    similar: boolean;
}

// 주소 → 읽은 것. 차단 목록이 바뀌어 다시 판정하거나 미리보기를 다시 열 때 또 읽지 않는다.
// 읽지 못한 것(이미지 호스트 권한이 없는 등)도 남겨 둔다. 지우면 판정할 때마다 이미지를 다시 요청한다.
// 오래 열어 둔 페이지에서 끝없이 늘지 않게 오래된 것부터 버린다. quick-lru는 maxSize의 두 배 가까이 남기므로 배경의 MAX_IMAGE_HASHES(500)와 비슷하다.
const imageReads = new QuickLRU<string, ImageRead>({maxSize: 250});

/** 파이어폭스 배경에 그 주소의 해시를 묻는다. similar가 아니면 지문을 기다리지 않고 파일 해시만 받는다. */
const askBackground = (url: string, similar: boolean): Promise<ImageHashes | undefined> =>
    sendMessage("refresher:imageHash", {url, similar}).catch(() => undefined);

// 처음 차단하거나 비슷한 이미지 설정을 켜면 열린 탭들이 받아 둔 이미지를 한꺼번에 다시 판정한다.
// 파이어폭스는 배경에 해시가 없으면 다시 받으므로, 요청이 몰려 디시의 요청 제한에 걸리지 않게 몇 개씩만 받는다.
const fetchLimit = pLimit(4);

/** onFile은 파일 해시를 구하자마자 부른다. */
const readImageHashes = async (url: string, similar: boolean, onFile: (file: string) => void): Promise<ImageHashes | undefined> => {
    // 파이어폭스 배경은 비슷한 이미지 설정이 켜져 있고 지문이 있는 항목이 있을 때만 지문을 구한다. 그렇지 않을 때 우클릭 차단하면 지문은 여기서 이미지를 다시 받아 구한다.
    const known = import.meta.env.BROWSER === "firefox" ? await askBackground(url, false) : undefined;
    if (known) onFile(known.file);
    const background = known && similar ? (await askBackground(url, true)) ?? known : known;
    if (background && (!similar || background.similar !== undefined)) return background;
    try {
        // 파이어폭스 콘텐츠 스크립트의 요청은 Referer를 붙이지 않아 디시가 403을 준다. 크롬은 원래 붙이고, 캐시 키에 들지 않아 캐시도 그대로 쓴다.
        // 바이트는 이 콜백 안에서만 쓴다. 밖에 두면 지문을 기다리는 동안 Blob에 더해 사본 한 벌이 남는다.
        const {file, hash} = await fetchLimit(async () => {
            // 콘텐츠 스크립트 자체의 fetch로 받아야 해서(파이어폭스의 http는 content.fetch라 페이지 CORS에 걸린다) 기본 ky로 받는다.
            // ky의 timeout은 .blob() 읽기까지 끊어 큰 움짤을 놓치므로 끄고 전체 상한만 둔다. 본문은 같은 요청의 .blob()으로 읽어야 이 상한에 묶인다.
            const request = ky.get(url, {cache: "force-cache", referrer: location.href, retry: 0, timeout: false, totalTimeout: 60_000});
            const response = await request;
            const file = await request.blob();
            const bytes = await file.arrayBuffer();
            // 크롬은 움짤이 구간 요청으로 받아 둔 캐시를 쓰면 206을 준다. 파일 전체를 담았을 때만 받는다 (Content-Range는 CORS로 읽지 못한다).
            if (response.status !== 200 && !(response.status === 206 && isWholeMp4(new Uint8Array(bytes)))) throw new Error(`HTTP ${response.status}`);
            return {file, hash: await sha256(bytes)};
        });
        onFile(hash);
        return {file: hash, similar: similar ? (await imageFingerprints(file)) ?? null : undefined};
    } catch (e) {
        console.warn("Image hash failed:", url, e);
        // 지문만 못 구했으면 배경이 구한 파일 해시로 같은 파일은 막는다.
        return background && {...background, similar: null};
    }
};

const readImage = async (url: string, {retry = false, similar = false}: { retry?: boolean; similar?: boolean }): Promise<ImageRead> => {
    const cached = imageReads.get(url);
    // 지문이 끝나기를 기다리지 않고 돌려준다. 같은 파일은 파일 해시가 나오자마자 막는다 (isImageBlocked).
    if (cached && !retry && (cached.similar || !similar)) return cached;
    const previous = await cached?.hashes;
    // 지문 없이 읽어 둔 것은 지문이 필요해지면 다시 읽는다 (비슷한 이미지 설정을 켰을 때). 읽지 못한 것은 retry일 때만 다시 읽는다.
    if (cached && (previous ? !similar || previous.similar !== undefined : !retry)) return cached;
    const file = Promise.withResolvers<string | undefined>();
    // 다시 읽다 실패하면 앞서 구한 파일 해시를 지킨다.
    const hashes = readImageHashes(url, similar, file.resolve).then((next) => next ?? previous);
    // 파일 해시를 먼저 알리지 못했으면(읽지 못한 등) 다 끝난 것으로 푼다. 먼저 푼 값이 남는다.
    void hashes.then((done) => file.resolve(done?.file));
    const read = {file: file.promise, hashes, similar};
    imageReads.set(url, read);
    return read;
};

/**
 * 이미지 파일의 SHA-256과, similar면 비슷한 이미지 지문. 파일 해시는 이미지 차단 항목의 내용이다. 읽지 못하면(이미지 호스트 권한이 없는 등) undefined다.
 * 크롬은 페이지가 받아 둔 캐시에서 읽는다. 배경의 규칙이 이 요청(같은 문서의 다른 fetch·XHR도)에 CORS 헤더를 붙인다 (features/block/background.ts).
 * 파이어폭스는 콘텐츠 스크립트의 요청이 페이지의 캐시를 쓰지 않아, 배경이 페이지의 응답을 흘려보내며 구해 둔 해시를 받는다.
 * 둘 다 캐시나 배경에 없으면 이미지를 한 번 더 받는다. retry면 앞서 읽지 못한 것도 다시 읽는다 (권한을 막 받은 뒤의 우클릭 차단).
 */
export const imageHash = async (url: string, options: { retry?: boolean; similar?: boolean } = {}): Promise<ImageHashes | undefined> =>
    (await readImage(url, options)).hashes;

/**
 * 움짤의 두 파일: 주소 → 짝 주소. 디시는 같은 움짤을 mp4(<video>)로 보이다가 그리지 못했거나 누르면 원본 gif(data-src)의 <img>로 바꾼다.
 * 파일이 달라 한쪽 해시로는 다른 쪽을 못 막으므로, 차단할 때 짝도 같이 넣는다 (stores/blockRequest.ts의 blockImage). <video>를 볼 때 적어 둔다.
 */
// 판정할 때마다 다시 적으므로 보이는 움짤은 밀려나지 않는다. 밀려나면 우클릭 차단이 한 파일만 넣으니 넉넉히 둔다.
const mediaPairs = new QuickLRU<string, string>({maxSize: 500});

/** 같은 움짤의 다른 파일 주소. 이 페이지에서 그 <video>를 보지 못했으면 undefined다. */
export const pairedMediaUrl = (url: string): string | undefined => mediaPairs.get(url);

const rememberPair = (video: HTMLVideoElement): void => {
    const gif = video.dataset.src ? URL.parse(video.dataset.src, location.href)?.href : undefined;
    // mp4를 받다 오류가 나면 currentSrc가 비고, 디시가 곧바로 gif로 바꾼다. <source>의 주소는 처음부터 있다.
    const mp4 = video.currentSrc || video.querySelector("source")?.src;
    if (!gif || !mp4 || gif === mp4) return;
    mediaPairs.set(mp4, gif);
    mediaPairs.set(gif, mp4);
};

/** 차단 모듈 설정의 비슷한 이미지 기준 (dHash·pHash가 각각 다를 수 있는 비트 수). 끄면 undefined다. 페이지(차단 모듈)와 미리보기가 같이 쓴다. */
export const similarImageThreshold = (settings: ModuleSettings["block"]): number | undefined =>
    settings.similarImages ? settings.similarThreshold : undefined;

// 표본(imageReads가 주소마다 같은 배열을 준다) → 지난 판정. 움짤은 반복 재생할 때마다(크롬은 seeked·canplaythrough 둘 다) 다시 보므로
// 목록(스토어는 바뀌면 새 배열을 만든다)·기본 모드·갤러리·기준이 그대로면 다시 훑지 않고, 걸린 항목만 다시 쓰였다고 적는다.
const similarHits = new WeakMap<Sample[], { entries: BlockEntry[]; mode: DetectMode; gallery: string | undefined; threshold: number; hits: BlockEntry[] }>();

/**
 * 표본이 비슷한 이미지 항목에 걸리는지 (isSimilarSet). 걸린 항목은 모두 쓰였다고 적는다. 지문이 없는 항목(지문이 생기기 전에 넣었거나 디코딩하지 못한 이미지)은 보지 않는다.
 * 불일치·불포함(NOT_*) 항목은 허용 목록이라 비슷한 이미지로 넓히지 않는다.
 */
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

/**
 * 움짤(<video>)을 다시 볼 이벤트. 더 받을 때(progress), 받기를 멈출 때(suspend), 반복 재생으로 처음으로 돌아갈 때(seeked).
 * 파이어폭스는 다 받은 뒤 progress·suspend 없이 끝나기도 해 반복 재생 때 다시 본다.
 */
export const VIDEO_CHECK_EVENTS = ["progress", "suspend", "canplaythrough", "seeked"];

/**
 * 다 받은 본문 이미지·움짤의 화소 수. 받기 전에 읽으면 확장이 따로 받아 캐시를 쓰지 못하므로 그때는 undefined다.
 * 움짤(<video>)은 파일 전체가 버퍼에 들어온 뒤다. 일부만 받은 mp4를 읽으면 나머지를 다시 받는다.
 */
const loadedPixels = (media: HTMLImageElement | HTMLVideoElement): number | undefined => {
    if (media instanceof HTMLImageElement) return media.complete && media.naturalWidth > 0 ? media.naturalWidth * media.naturalHeight : undefined;
    const {buffered, duration} = media;
    const whole = media.readyState === HTMLMediaElement.HAVE_ENOUGH_DATA && buffered.length === 1 && buffered.start(0) === 0 && buffered.end(0) >= duration - 0.05;
    return whole ? media.videoWidth * media.videoHeight : undefined;
};

/**
 * 이미지·움짤이 차단 목록(IMAGE)에 든 파일인지. similar(기준 비트 수)를 주면 좌우 반전을 포함해 비슷한 이미지·움짤도 막는다.
 * 다 받은 것만 본다 (loadedPixels). 지연 로딩·원본 보기로 주소가 바뀌거나 움짤을 더 받으면 load·progress 때 다시 부른다.
 */
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
    // 지문은 한 번에 하나씩 구해 앞선 이미지·움짤이 많으면 늦으므로, 같은 파일은 파일 해시가 나오자마자 막는다.
    const file = await read.file;
    if (!file) return false;
    // isBlocked가 NOT_* 항목(허용 목록)까지 판정한다.
    const exact = isBlocked("IMAGE", file, gallery);
    if (threshold === undefined) return exact;
    // 같은 파일이어도 비슷한 이미지 항목을 마저 봐서 걸린 항목을 모두 쓰였다고 적는다.
    const near = read.hashes.then((hashes) => !!hashes?.similar && isSimilarBlocked(hashes.similar, gallery, threshold));
    return exact || near;
};

/**
 * 차단 표시(data-blocked)로 가려진 요소인지. '가린 내용 보기'(data-block-revealed)나 미리보기의 이 글에서 가린 댓글 보기(data-comments-revealed) 중이거나
 * 흐림 차단을 흐림 풀기(data-blur-reveal)로 밝힌 동안은 가려지지 않은 것으로 본다.
 * 미리보기의 큰 이미지(Frame)와 디시콘 정보 창(openDcconInfo)이 같은 기준을 쓴다.
 */
export const isBlockedHidden = (element: Element): boolean => {
    const blocked = element.closest("[data-blocked]");
    if (!blocked || element.closest("[data-block-revealed], [data-comments-revealed]")) return false;
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

/** 내용이 차단 대상인지 (갤러리 한정 항목은 그 갤러리에서만). */
export const isBlocked = (type: BlockType, content: string, gallery?: string): boolean =>
    content !== "" && isBlockedIn(useBlocksStore.getState(), type, content, gallery);

/** 값 중 하나라도 차단 대상인지. 막힌 유형에서 멈추지 않고 모든 유형을 본다. */
export const isAnyBlocked = (values: BlockValues, gallery?: string): boolean =>
    // some을 바로 쓰면 첫 막힌 유형에서 멈춰 다른 유형 항목(같은 유저를 아이디로도 막은 것 등)의 markUsed가 빠진다.
    objectEntries(values).map(([type, value]) => (value ? isBlocked(type, value, gallery) : false)).some(Boolean);

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
 * 컴포넌트에서는 구독한 목록을 lists로 넘긴다. 기본값(getState)은 구독하지 않아
 * 차단 목록이 바뀌어도 다시 그리지 않는다.
 */
export const blockingEntries = (values: BlockValues, gallery?: string, lists: BlockLists = useBlocksStore.getState()): { type: BlockType; entry: BlockEntry }[] =>
    objectEntries(values).flatMap(([type, value]) =>
        value ? blockingIn(lists, type, value, gallery).map((entry) => ({type, entry})) : []
    );
