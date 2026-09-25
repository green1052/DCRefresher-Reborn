import DOMPurify, {type Config} from "dompurify";

// 동영상엔 재생 컨트롤을 붙인다 (디시 본문은 컨트롤 없이 스크립트로 재생)
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.nodeName === "VIDEO") node.setAttribute("controls", "");
});

// 인라인 style은 오버레이 레이아웃을 깨므로 제거, 디시 본문의 동영상 임베드(iframe)는 허용
const BASE: Config = {FORBID_ATTR: ["style"], ADD_TAGS: ["iframe"], ADD_ATTR: ["allowfullscreen", "frameborder", "allow"]};
const NO_MEDIA: Config = {...BASE, FORBID_TAGS: ["img", "video", "iframe", "audio", "embed", "source", "picture"]};

/**
 * 디시 게시글/댓글 HTML → 오버레이에 넣을 수 있는 HTML.
 * 오버레이도 페이지 DOM이라 인라인 핸들러가 페이지 컨텍스트에서 실행되므로 반드시 거친다.
 */
export const sanitizeHtml = (html: string, options: { stripMedia?: boolean } = {}): string =>
    DOMPurify.sanitize(html, options.stripMedia ? NO_MEDIA : BASE);
