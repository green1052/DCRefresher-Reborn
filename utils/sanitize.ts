import DOMPurify, {type Config, type DOMPurify as Purifier} from "dompurify";

/** 움직이는 디시콘도 <video>로 온다. written_dccon 클래스나 dccon.php 주소로 일반 동영상과 구분한다 */
const isDccon = (node: Element): boolean =>
    node.classList.contains("written_dccon") || /dccon\.php/.test(`${node.getAttribute("src")} ${node.getAttribute("data-src")}`);

// 동영상에는 재생 컨트롤을 붙인다. 디시 본문은 컨트롤 없이 페이지 스크립트로 재생하기 때문이다.
// 디시콘은 디시처럼 컨트롤 없이 자동 반복 재생한다.
// 이미지·iframe은 lazy로 두어 스텔스·이미지 차단으로 숨긴 것은 받지 않게 한다.
// 링크(# 앵커 제외)는 새 탭으로 연다. DOMPurify가 target을 지우므로 두면 갤러리 탭이 링크로 넘어가 목록과 미리보기를 잃는다.
const onAttributes = (node: Element): void => {
    if (node.nodeName === "VIDEO") {
        if (!isDccon(node)) node.setAttribute("controls", "");
        else for (const attribute of ["autoplay", "loop", "muted", "playsinline"]) node.setAttribute(attribute, "");
    } else if (node.nodeName === "IMG" || node.nodeName === "IFRAME") {
        node.setAttribute("loading", "lazy");
    } else if (node.nodeName === "A" && !(node.getAttribute("href") ?? "#").startsWith("#")) {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
    }
};

// 디시 편집기로 넣은 유튜브는 <embed src="https://www.youtube.com/embed/…">다. DOMPurify는 embed를 버리므로 같은 주소의 iframe으로 바꾼다
const YOUTUBE_EMBED = /<embed\s[^>]*?src="(https:\/\/www\.youtube(?:-nocookie)?\.com\/embed\/[^"]+)"[^>]*>/gi;
const embedYoutube = (html: string): string =>
    html.includes("<embed") ? html.replace(YOUTUBE_EMBED, "<iframe src=\"$1\" width=\"560\" height=\"315\" allowfullscreen></iframe>") : html;

// 인라인 style은 오버레이 레이아웃을 깨므로 지우고, 본문의 동영상 임베드(iframe)는 허용한다.
// <style>은 shadow 루트 전체(창·댓글·가린 내용)에 걸리고, 폼 요소는 본문에 필요 없는데 가짜 입력칸을 만들 수 있어 뺀다.
// SVG <feImage>와 background 속성은 원격 이미지를 불러오는데 미디어 숨기기(태그·CSS)에 걸리지 않는다. 본문에 쓸 일도 없어 뺀다.
// IN_PLACE: sanitizeHtml이 <template> 안의 요소를 그 자리에서 정화한다.
const FORBIDDEN = ["style", "form", "input", "textarea", "select", "feimage"];
const BASE: Config = {
    FORBID_ATTR: ["style", "background"],
    FORBID_TAGS: FORBIDDEN,
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["allowfullscreen", "frameborder", "allow", "scrolling"],
    IN_PLACE: true
};
// SVG <image>도 원격 이미지를 불러온다
const NO_MEDIA: Config = {...BASE, FORBID_TAGS: [...FORBIDDEN, "img", "video", "iframe", "audio", "embed", "source", "picture", "image"]};

// 설정을 고정한 인스턴스를 쓴다. sanitize(html, cfg)는 호출마다 허용 목록을 다시 만든다.
// 인스턴스는 처음 쓸 때 만든다(정화할 일이 없는 페이지에서는 만들지 않게).
const make = (cfg: Config): Purifier => {
    const purify = DOMPurify();
    purify.setConfig(cfg);
    purify.addHook("afterSanitizeAttributes", onAttributes);
    return purify;
};

let base: Purifier | undefined;
let noMedia: Purifier | undefined;

let template: HTMLTemplateElement | undefined;

/**
 * 디시 게시글/댓글 HTML을 오버레이에 넣을 수 있게 정화한다.
 * 오버레이도 페이지 DOM이라 인라인 핸들러가 페이지 컨텍스트에서 실행되므로 반드시 거쳐야 한다.
 * 문자열을 넘기면 DOMPurify가 호출마다 새 문서를 만드는데, <video>(디시콘 등)가 든 문서는 크롬에서 해제되지 않는다.
 * 그래서 재사용하는 <template> 하나(스크립트·로딩이 없는 문서)에 넣고 그 자리에서 정화한다.
 */
export const sanitizeHtml = (html: string, options: { stripMedia?: boolean } = {}): string => {
    const purify = options.stripMedia ? (noMedia ??= make(NO_MEDIA)) : (base ??= make(BASE));
    template ??= document.createElement("template");
    template.innerHTML = `<div>${options.stripMedia ? html : embedYoutube(html)}</div>`;

    const root = template.content.firstElementChild!;
    purify.sanitize(root);
    const clean = root.innerHTML;
    template.innerHTML = "";
    return clean;
};

/**
 * 직렬화된 HTML(innerHTML·DOMPurify 결과) → 차단어 검사용 평문.
 * 태그만 떼면 &amp; 같은 엔티티가 남아 'R&B', '<3' 같은 차단어가 안 걸린다.
 */
export const htmlToText = (html: string): string => {
    // 직렬화는 속성값 안의 '>'를 이스케이프하지 않는다.
    // 속성값(직렬화 결과는 늘 큰따옴표)과 주석을 통째로 건너뛰어야 속성 글자가 본문으로 새지 않는다.
    const text = html.includes("<") ? html.replace(/<!--[\s\S]*?-->|<(?:[^>"]|"[^"]*")*>/g, " ") : html;
    if (!text.includes("&")) return text;

    // 직렬화는 텍스트의 &, <, >, U+00A0만 이스케이프한다. &amp;는 마지막에 풀어야 '&amp;lt;'가 '<'로 두 번 풀리지 않는다
    return text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
};
