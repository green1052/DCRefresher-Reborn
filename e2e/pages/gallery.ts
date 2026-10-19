import type {Page} from "@playwright/test";

/** 글 페이지의 디시 요소. 페이지를 연 뒤에 부른다 (가짜 글은 e2e/dcinside.ts). */
export const viewPage = (page: Page) => ({
    /** 글 본문. */
    body: page.locator(".write_div"),
    /** 글 아래 댓글 줄. */
    comments: page.locator(".cmt_list > li"),
    /** 글 머리 작성자에 붙은 유저 정보 배지. */
    headBadges: page.locator(".gallview_head .refresher-user-badges")
});

/** 갤러리 관리 페이지(/mini/management/)의 디시 요소. */
export const managementPage = (page: Page) => ({
    /** 왼쪽 설정 메뉴. */
    menu: page.locator(".minor_uadmin_menu")
});
