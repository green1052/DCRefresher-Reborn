import DOMPurify, {type Config, type DOMPurify as Purifier} from "dompurify";

/** 움짤(gif를 mp4로 바꾼 것)과 디시콘 <video> - data-src나 디시콘 표시로 일반 동영상과 구분한다. */
const isGifVideo = (node: Element): boolean =>
    node.hasAttribute("data-src") || node.classList.contains("written_dccon") || /dccon\.php/.test(node.getAttribute("src") ?? "");

// 인라인 style은 글 서식만 남긴다 - 위치, display, 배경 이미지, 음수 여백은 창을 덮거나 숨기기 규칙을 이긴다.
const KEPT_STYLE = /^(?:color|background-color|font-.+|text-(?:align|indent|decoration|wrap).*|white-space.*|line-height|letter-spacing|word-spacing|vertical-align|border-(?!image).+|padding.*|margin.*|width|height|table-layout)$/;

const autoHeight = (node: Element): boolean =>
    node.nodeName === "IMG" || node.nodeName === "VIDEO" || (node.nodeName === "IFRAME" && (node.getAttribute("src") ?? "").includes("youtube"));

const keepFormatting = (node: HTMLElement | SVGElement): void => {
    const {style} = node;
    for (const name of [...style]) {
        const dropped = !KEPT_STYLE.test(name)
            || (name === "height" && autoHeight(node))
            // 디시 투표(pollFrame)는 width, height 0으로 와서 페이지 스크립트가 내용 크기로 늘린다. 미리보기엔 그 스크립트가 없어 0이면 지워 width, height 속성 크기로 보인다.
            || ((name === "width" || name === "height") && node.nodeName === "IFRAME" && Number.parseFloat(style.getPropertyValue(name)) === 0)
            || (name.startsWith("margin") && style.getPropertyValue(name).includes("-"));
        if (dropped) style.removeProperty(name);
    }
    if (style.length === 0) node.removeAttribute("style");
};

/** iframe에 넘겨도 되는 권한. 동영상 재생에 쓰는 것만 남기고, 카메라, 마이크, 클립보드 같은 권한은 본문이 넘기지 못하게 한다. */
const IFRAME_ALLOW = new Set(["autoplay", "encrypted-media", "fullscreen", "picture-in-picture"]);

// 동영상엔 controls, 디시콘·움짤은 자동 반복. 이미지·iframe은 lazy, 링크는 새 탭, # 앵커는 주소를 뗀다.
const onAttributes = (node: Element): void => {
    // MathML(<math>) 같은 나머지 요소는 서식만 골라 지울 수 없어(HTMLElement, SVGElement가 아니다) style을 통째로 지운다.
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
    } else if (node.localName === "a" || node.localName === "area") {
        // SVG <a>(nodeName이 소문자 a, 주소는 href나 xlink:href)와 이미지 맵 <area>도 링크다.
        const href = node.getAttribute("href") ?? node.getAttribute("xlink:href");
        if (href === null) return;
        if (href.startsWith("#")) {
            node.removeAttribute("href");
            node.removeAttribute("xlink:href");
            return;
        }
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
    }
};

// 디시 편집기로 넣은 유튜브는 <embed src="https://www.youtube.com/embed/...">다. DOMPurify는 embed를 버리므로 같은 주소의 iframe으로 바꾼다.
const YOUTUBE_EMBED = /<embed\s[^>]*?src="(https:\/\/www\.youtube(?:-nocookie)?\.com\/embed\/[^"]+)"[^>]*>/gi;
const embedYoutube = (html: string): string =>
    html.includes("<embed") ? html.replace(YOUTUBE_EMBED, "<iframe src=\"$1\" width=\"560\" height=\"315\" allowfullscreen></iframe>") : html;

// 확장 UI·가림 상태 지키기: <style>은 shadow 전체에 걸리고, 폼·feImage·background는 가짜 UI·원격 이미지를 만들 수 있고, popover와 data-* 표시는 확장이 쓴다.
const FORBIDDEN = ["style", "form", "input", "textarea", "select", "feimage"];
const BASE: Config = {
    FORBID_ATTR: [
        "background", "popover", "popovertarget", "popovertargetaction", "commandfor", "command", "data-slot",
        "data-blocked", "data-block-revealed", "data-comments-revealed", "data-blur-reveal", "data-duplicate", "data-low-activity"
    ],
    FORBID_TAGS: FORBIDDEN,
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["allowfullscreen", "frameborder", "allow", "scrolling"],
    IN_PLACE: true
};
// SVG <image>도 원격 이미지를 불러온다.
const NO_MEDIA: Config = {...BASE, FORBID_TAGS: [...FORBIDDEN, "img", "video", "iframe", "audio", "embed", "source", "picture", "image"]};

// 설정을 고정한 인스턴스를 처음 쓸 때 만든다. sanitize(html, cfg)는 호출마다 허용 목록을 다시 만든다.
const make = (cfg: Config): Purifier => {
    const purify = DOMPurify();
    purify.setConfig(cfg);
    purify.addHook("afterSanitizeAttributes", onAttributes);
    return purify;
};

let base: Purifier | undefined;
let noMedia: Purifier | undefined;

/** 스크립트, 로딩이 없는 문서 (<template>의 내용 문서). 정화할 HTML을 여기서 파싱한다. */
let inert: Document | undefined;

/** 게시글/댓글 HTML을 정화한다. 재사용하는 비활성 문서에서 파싱한다(<video> 든 문서의 크롬 누수 방지). */
export const sanitizeHtml = (html: string, options: { stripMedia?: boolean } = {}): string => {
    const purify = options.stripMedia ? (noMedia ??= make(NO_MEDIA)) : (base ??= make(BASE));
    inert ??= document.createElement("template").content.ownerDocument;
    // <div>로 감싼 문자열을 넣지 않고 div 안에 바로 넣는다. 문자열로 감싸면 댓글 HTML의 남는 </div>가 감싼 div를 닫아 그 뒤가 버려진다.
    const root = inert.createElement("div");
    root.innerHTML = options.stripMedia ? html : embedYoutube(html);
    purify.sanitize(root);
    return root.innerHTML;
};

/** 직렬화된 HTML → 평문. 태그만 떼면 엔티티가 남아 'R&B' 같은 차단어가 안 걸린다. */
export const htmlToText = (html: string): string => {
    // 속성값 안의 '>'는 이스케이프되지 않아 속성과 주석을 통째로 건너뛴다.
    const text = html.includes("<") ? html.replace(/<!--[\s\S]*?-->|<(?:[^>"]|"[^"]*")*>/g, " ") : html;
    if (!text.includes("&")) return text;

    // 직렬화는 텍스트의 &, <, >, U+00A0만 이스케이프한다. &amp;는 마지막에 풀어야 '&amp;lt;'가 '<'로 두 번 풀리지 않는다.
    return text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
};
