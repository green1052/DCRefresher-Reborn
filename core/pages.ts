/** 콘텐츠 스크립트가 도는 주소. 페이지 CSS(entrypoints/page.content.css)도 같은 곳에 넣는다 (wxt.config.ts). */
export const CONTENT_MATCHES = ["https://*.dcinside.com/*"];
export const CONTENT_EXCLUDE_MATCHES = [
    "https://event.dcinside.com/*",
    "https://h5.dcinside.com/*",
    "https://m.dcinside.com/*",
    "https://mall.dcinside.com/*",
    "https://wiki.dcinside.com/*",
    "https://gallog.dcinside.com/*",
    // 이미지 팝업(viewimagePop.php)은 원래 gall 탭과 같은 렌더러에서 돌아 번들 평가·저장소 읽기 비용이 그 탭에 그대로 더해진다.
    // 로그인 페이지(sign)는 제외해도 폰트만 빠진다.
    "https://image.dcinside.com/*",
    "https://sign.dcinside.com/*"
];

/** 글 목록·본문. */
export const BOARD_PAGE = /\/board\/(view|lists)/;
/** 글 본문. */
export const VIEW_PAGE = /\/board\/view/;
/** 글쓰기·수정. */
export const WRITE_PAGE = /\/board\/(write|modify)/;
/** 글 목록. */
export const LIST_PAGE = /\/board\/lists/;

/**
 * 디시가 요청이 너무 많을 때 주는 임시 차단 페이지인지. 본문(<body>)이 빈 문서가 온다.
 * 받은 응답을 보는 HTTP 클라이언트(detectBlocked)가 쓴다. 지금 페이지는 콘텐츠 스크립트가 DOM으로 따로 본다 (refresher-root 제외).
 */
export const isBlockedPage = (html: string): boolean => {
    // 정규식을 쓰지 않는다. 엔진은 마지막 정규식의 입력(응답 전체, 수백 KB)을 다음 정규식이 돌 때까지 붙잡는다.
    const body = html.indexOf("<body");
    const open = body === -1 ? -1 : html.indexOf(">", body);
    const close = html.lastIndexOf("</body>");
    return (open !== -1 && open < close ? html.slice(open + 1, close) : html).trim() === "";
};

export const BLOCKED_PAGE_MESSAGE = "요청이 많아 디시인사이드가 잠시 접속을 막았습니다. 잠시 기다린 뒤 새로고침해 주세요.";
