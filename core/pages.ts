/** 글 목록·본문 */
export const BOARD_PAGE = /\/board\/(view|lists)/;
/** 글 본문 */
export const VIEW_PAGE = /\/board\/view/;
/** 글쓰기·수정 */
export const WRITE_PAGE = /\/board\/(write|modify)/;
/** 글 목록 */
export const LIST_PAGE = /\/board\/lists/;

/**
 * 디시가 요청이 너무 많을 때 주는 임시 차단 페이지인지. 본문(<body>)이 빈 문서가 온다.
 * 받은 HTML을 보는 쪽(새로고침·미리보기)과 지금 페이지를 보는 쪽(콘텐츠 스크립트)이 같이 쓴다
 */
export const isBlockedPage = (html: string): boolean => (/<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? html).trim() === "";

export const BLOCKED_PAGE_MESSAGE = "요청이 많아 디시인사이드가 잠시 접속을 막았습니다. 잠시 기다린 뒤 새로고침해 주세요.";
