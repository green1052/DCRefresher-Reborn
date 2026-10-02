import DOMPurify, {type Config, type DOMPurify as Purifier} from "dompurify";

/**
 * 움직이는 디시콘과 본문 움짤(gif를 mp4로 바꾼 것)도 <video>로 온다. 디시는 둘 다 data-src에 대신 보일 gif 주소를 달아 둔다.
 * 그것이나 디시콘 표시(written_dccon 클래스, dccon.php 주소)로 일반 동영상과 구분한다.
 */
const isGifVideo = (node: Element): boolean =>
    node.hasAttribute("data-src") || node.classList.contains("written_dccon") || /dccon\.php/.test(node.getAttribute("src") ?? "");

// 인라인 style은 글 서식(글자·색·표·여백·크기)만 남긴다. 위치·표시(display)·배경 이미지 같은 나머지는
// 창을 벗어나거나 숨기기 규칙(스텔스·관리자 가림)을 이기거나 원격 이미지를 불러오므로 지운다.
// 음수 여백은 본문을 창 머리(제목·작성자·버튼)나 댓글 위로 끌어올려 덮으므로 지운다 (calc(0px - 400px)도 '-'가 든다).
// 이미지·동영상·유튜브의 높이는 CSS의 height: auto(유튜브는 16:9)가 이겨야 창보다 넓은 것이 줄어들 때 비율이 맞는다.
const KEPT_STYLE = /^(?:color|background-color|font-.+|text-(?:align|indent|decoration|wrap).*|white-space.*|line-height|letter-spacing|word-spacing|vertical-align|border-(?!image).+|padding.*|margin.*|width|height|table-layout)$/;

const autoHeight = (node: Element): boolean =>
    node.nodeName === "IMG" || node.nodeName === "VIDEO" || (node.nodeName === "IFRAME" && (node.getAttribute("src") ?? "").includes("youtube"));

const keepFormatting = (node: HTMLElement | SVGElement): void => {
    const {style} = node;
    for (const name of [...style]) {
        const dropped = !KEPT_STYLE.test(name)
            || (name === "height" && autoHeight(node))
            || (name.startsWith("margin") && style.getPropertyValue(name).includes("-"));
        if (dropped) style.removeProperty(name);
    }
    if (style.length === 0) node.removeAttribute("style");
};

/** iframe에 넘겨도 되는 권한. 동영상 재생에 쓰는 것만 남기고, 카메라·마이크·클립보드 같은 권한은 본문이 넘기지 못하게 한다. */
const IFRAME_ALLOW = new Set(["autoplay", "encrypted-media", "fullscreen", "picture-in-picture"]);

// 동영상에는 재생 컨트롤을 붙인다. 디시 본문은 컨트롤 없이 페이지 스크립트로 재생하기 때문이다.
// 디시콘·움짤은 디시처럼 컨트롤 없이 자동 반복 재생한다.
// 이미지·iframe은 lazy로 두어 스텔스·이미지 차단으로 숨긴 것은 받지 않게 한다.
// 링크(# 앵커 제외)는 새 탭으로 연다. DOMPurify가 target을 지우므로 두면 갤러리 탭이 링크로 넘어가 목록과 미리보기를 잃는다.
const onAttributes = (node: Element): void => {
    // MathML(<math>) 같은 나머지 요소는 서식만 골라 지울 수 없어(HTMLElement·SVGElement가 아니다) style을 통째로 지운다.
    if (node.hasAttribute("style")) {
        if (node instanceof HTMLElement || node instanceof SVGElement) keepFormatting(node);
        else node.removeAttribute("style");
    }

    if (node.nodeName === "VIDEO") {
        if (!isGifVideo(node)) node.setAttribute("controls", "");
        else for (const attribute of ["autoplay", "loop", "muted", "playsinline"]) node.setAttribute(attribute, "");
    } else if (node.nodeName === "IMG" || node.nodeName === "IFRAME") {
        node.setAttribute("loading", "lazy");
        const allow = node.getAttribute("allow");
        if (allow !== null) {
            const kept = allow.split(";").map((item) => item.trim()).filter((item) => IFRAME_ALLOW.has(item.split(/\s/)[0]!.toLowerCase()));
            if (kept.length > 0) node.setAttribute("allow", kept.join("; "));
            else node.removeAttribute("allow");
        }
    } else if (node.nodeName === "A" && !(node.getAttribute("href") ?? "#").startsWith("#")) {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
    }
};

// 디시 편집기로 넣은 유튜브는 <embed src="https://www.youtube.com/embed/…">다. DOMPurify는 embed를 버리므로 같은 주소의 iframe으로 바꾼다.
const YOUTUBE_EMBED = /<embed\s[^>]*?src="(https:\/\/www\.youtube(?:-nocookie)?\.com\/embed\/[^"]+)"[^>]*>/gi;
const embedYoutube = (html: string): string =>
    html.includes("<embed") ? html.replace(YOUTUBE_EMBED, "<iframe src=\"$1\" width=\"560\" height=\"315\" allowfullscreen></iframe>") : html;

// 인라인 style은 서식만 남기고(keepFormatting), 본문의 동영상 임베드(iframe)는 허용한다.
// <style>은 shadow 루트 전체(창·댓글·가린 내용)에 걸리고, 폼 요소는 본문에 필요 없는데 가짜 입력칸을 만들 수 있어 뺀다.
// SVG <feImage>와 background 속성은 원격 이미지를 불러오는데 미디어 숨기기(태그·CSS)에 걸리지 않는다. 본문에 쓸 일도 없어 뺀다.
// popover·command 속성은 본문 버튼으로 <dialog>나 팝오버를 최상위 층에 띄운다. 남긴 크기·배경색과 합치면 화면 전체를 덮는 가짜 창이 되어 뺀다.
// IN_PLACE: sanitizeHtml이 비활성 문서의 요소를 그 자리에서 정화한다.
const FORBIDDEN = ["style", "form", "input", "textarea", "select", "feimage"];
const BASE: Config = {
    FORBID_ATTR: ["background", "popover", "popovertarget", "popovertargetaction", "commandfor", "command"],
    FORBID_TAGS: FORBIDDEN,
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["allowfullscreen", "frameborder", "allow", "scrolling"],
    IN_PLACE: true
};
// SVG <image>도 원격 이미지를 불러온다.
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

/** 스크립트·로딩이 없는 문서 (<template>의 내용 문서). 정화할 HTML을 여기서 파싱한다. */
let inert: Document | undefined;

/**
 * 디시 게시글/댓글 HTML을 오버레이에 넣을 수 있게 정화한다.
 * 오버레이도 페이지 DOM이라 인라인 핸들러가 페이지 컨텍스트에서 실행되므로 반드시 거쳐야 한다.
 * 문자열을 넘기면 DOMPurify가 호출마다 새 문서를 만드는데, <video>(디시콘 등)가 든 문서는 크롬에서 해제되지 않는다.
 * 그래서 재사용하는 비활성 문서 하나에서 파싱해 그 자리에서 정화한다.
 */
export const sanitizeHtml = (html: string, options: { stripMedia?: boolean } = {}): string => {
    const purify = options.stripMedia ? (noMedia ??= make(NO_MEDIA)) : (base ??= make(BASE));
    inert ??= document.createElement("template").content.ownerDocument;
    // <div>로 감싼 문자열을 넣지 않고 div 안에 바로 넣는다. 문자열로 감싸면 댓글 HTML의 남는 </div>가 감싼 div를 닫아 그 뒤가 버려진다.
    const root = inert.createElement("div");
    root.innerHTML = options.stripMedia ? html : embedYoutube(html);
    purify.sanitize(root);
    return root.innerHTML;
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

    // 직렬화는 텍스트의 &, <, >, U+00A0만 이스케이프한다. &amp;는 마지막에 풀어야 '&amp;lt;'가 '<'로 두 번 풀리지 않는다.
    return text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
};
