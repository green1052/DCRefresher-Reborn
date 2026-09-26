// 모듈 urls와 페이지 판별에 쓰는 디시 페이지 주소 패턴

/** 글 목록·본문 — 차단·메모·IP DB를 쓰는 페이지 */
export const BOARD_PAGE = /\/board\/(view|lists)/;
/** 글 본문 */
export const VIEW_PAGE = /\/board\/view/;
/** 글쓰기·수정 */
export const WRITE_PAGE = /\/board\/(write|modify)/;
