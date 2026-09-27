import DOMPurify, {type Config, type DOMPurify as Purifier} from "dompurify";

/** 움직이는 디시콘도 <video>다 (본문·댓글 모두 written_dccon, 주소는 dccon.php) */
const isDccon = (node: Element): boolean =>
    node.classList.contains("written_dccon") || /dccon\.php/.test(`${node.getAttribute("src")} ${node.getAttribute("data-src")}`);

// 동영상엔 재생 컨트롤을 붙인다 (디시 본문은 컨트롤 없이 스크립트로 재생). 디시콘은 재생바 없이 디시처럼 저절로 반복 재생한다.
// 이미지·iframe은 보일 때 받는다 — 스텔스·이미지 차단으로 숨긴 것은 받지 않는다
const onAttributes = (node: Element): void => {
    if (node.nodeName === "VIDEO") {
        if (!isDccon(node)) node.setAttribute("controls", "");
        else for (const attribute of ["autoplay", "loop", "muted", "playsinline"]) node.setAttribute(attribute, "");
    } else if (node.nodeName === "IMG" || node.nodeName === "IFRAME") {
        node.setAttribute("loading", "lazy");
    }
};

// 디시 편집기로 넣은 유튜브는 <embed src="https://www.youtube.com/embed/…">다 — DOMPurify는 embed를 버리므로 같은 주소의 iframe으로 바꾼다
const YOUTUBE_EMBED = /<embed\s[^>]*?src="(https:\/\/www\.youtube(?:-nocookie)?\.com\/embed\/[^"]+)"[^>]*>/gi;
const embedYoutube = (html: string): string =>
    html.includes("<embed") ? html.replace(YOUTUBE_EMBED, "<iframe src=\"$1\" width=\"560\" height=\"315\" allowfullscreen></iframe>") : html;

// 인라인 style은 오버레이 레이아웃을 깨므로 제거, 디시 본문의 동영상 임베드(iframe)는 허용
const BASE: Config = {FORBID_ATTR: ["style"], ADD_TAGS: ["iframe"], ADD_ATTR: ["allowfullscreen", "frameborder", "allow", "scrolling"]};
const NO_MEDIA: Config = {...BASE, FORBID_TAGS: ["img", "video", "iframe", "audio", "embed", "source", "picture"]};

// 설정을 고정한 인스턴스 — sanitize(html, cfg)는 부를 때마다 허용 목록을 새로 만든다. 처음 쓸 때 만든다 (모든 페이지에서 만들지 않게)
const make = (cfg: Config): Purifier => {
    const purify = DOMPurify();
    purify.setConfig(cfg);
    purify.addHook("afterSanitizeAttributes", onAttributes);
    return purify;
};

let base: Purifier | undefined;
let noMedia: Purifier | undefined;

/**
 * 디시 게시글/댓글 HTML → 오버레이에 넣을 수 있는 HTML.
 * 오버레이도 페이지 DOM이라 인라인 핸들러가 페이지 컨텍스트에서 실행되므로 반드시 거친다.
 */
export const sanitizeHtml = (html: string, options: { stripMedia?: boolean } = {}): string =>
    options.stripMedia ? (noMedia ??= make(NO_MEDIA)).sanitize(html) : (base ??= make(BASE)).sanitize(embedYoutube(html));

/**
 * 직렬화된 HTML(innerHTML·DOMPurify 결과) → 차단어 검사용 평문.
 * 태그만 떼면 &amp; 같은 엔티티가 남아 'R&B', '<3' 같은 차단어가 안 걸린다.
 */
export const htmlToText = (html: string): string => {
    // 직렬화는 속성값의 '>'를 이스케이프하지 않는다 — 값("…", 직렬화는 늘 큰따옴표)과 주석은 통째로 건너뛰어야 속성 글자가 새지 않는다
    const text = html.includes("<") ? html.replace(/<!--[\s\S]*?-->|<(?:[^>"]|"[^"]*")*>/g, " ") : html;
    if (!text.includes("&")) return text;

    // 직렬화는 텍스트의 &, <, >, U+00A0만 이스케이프한다. &amp;는 마지막에 풀어야 '&amp;lt;'가 '<'로 두 번 풀리지 않는다
    return text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
};
