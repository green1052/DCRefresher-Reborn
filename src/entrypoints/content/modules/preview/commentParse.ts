import eventBus from "@/core/eventbus";
import {extractDcconCode} from "@/utils/dccon";
import {LRUCache} from "@/utils/lruCache";

// 댓글 날짜 파싱 (연도 없으면 현재 연도 추가)
export function parseCommentDate(str: string): string {
    // 앞 4자리에 점이 있으면 "MM.DD ..." 형태 (연도 없음)
    const missingYear = str.substring(0, 4).match(/\./);
    return missingYear
        ? `${new Date().getFullYear()}-${str.replace(/\./g, "-")}`
        : str.replace(/\./g, "-");
}

// 디시콘 컨텍스트 메뉴 (우클릭 시 디시콘 차단 메뉴)
export function handleDcconContextMenu(e: MouseEvent): void {
    if (!e.target || !(e.target instanceof HTMLElement)) return;
    const element = e.target;

    if (element.classList.contains("written_dccon")) return;

    const src = element.getAttribute("src");
    if (!src) return;

    const code = extractDcconCode(src);

    eventBus.emit("refresherUserContextMenu", {nick: null, id: null, ip: null, code, packageIdx: null});
}

// 디시콘 메모 판별/식별: 차단 필터와 댓글 렌더가 같은 마크업을 알아야 하므로 단일 출처.
export const DCCON_MEMO_PATTERN = /<(img|video) class=/;

export const extractDcconNo = (memo: string): string | null =>
    /https:\/\/dcimg5\.dcinside\.com\/dccon\.php\?no=(\w*)/.exec(memo)?.[1] ?? null;

// 음성 댓글 데이터 파싱
interface VoiceData {
    iframe: boolean;
    src: string;
    memo: string;
}

export function parseVoiceData(memo: string): VoiceData | null {
    const parts = memo.split("@^dc^@");
    if (parts.length < 2) return null;

    const hasIframe = parts[0].indexOf("iframe") > -1;

    return {
        iframe: hasIframe,
        src: hasIframe
            ? (parts[0].split("src=\"")[1]?.split("\"")[0] ?? "")
            : "https://vr.dcinside.com/" + parts[0],
        memo: parts[1]
    };
}

// gallog_icon HTML 파싱 결과 캐싱 (DOMParser 반복 생성 방지, 크기 제한)
const gallogIconCache = new LRUCache<string, string | null>(500);

export const extractIconFromGallog = (gallogIcon: string): string | null => {
    const cached = gallogIconCache.get(gallogIcon);
    if (cached !== undefined) return cached;

    const doc = new DOMParser().parseFromString(gallogIcon, "text/html");
    const src = doc.querySelector("a.writer_nikcon img")?.getAttribute("src") ?? null;

    gallogIconCache.set(gallogIcon, src);
    return src;
};
