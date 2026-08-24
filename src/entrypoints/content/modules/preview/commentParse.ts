import eventBus from "@/core/eventbus";
import {extractDcconCode} from "@/utils/dccon";

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

    eventBus.emit("refresherUserContextMenu", null, null, null, code, null);
}

// 음성 댓글 데이터 파싱
export interface VoiceData {
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

// gallog_icon HTML 파싱 결과 캐싱 (DOMParser 반복 생성 방지)
const gallogIconCache = new Map<string, string | null>();

export const extractIconFromGallog = (gallogIcon: string): string | null => {
    const cached = gallogIconCache.get(gallogIcon);
    if (cached !== undefined) return cached;

    const doc = new DOMParser().parseFromString(gallogIcon, "text/html");
    const src = doc.querySelector("a.writer_nikcon img")?.getAttribute("src") ?? null;

    gallogIconCache.set(gallogIcon, src);
    return src;
};
