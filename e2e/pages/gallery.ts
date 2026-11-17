import type {Page} from "@playwright/test";

/** 글 페이지의 디시 요소. 페이지를 연 뒤에 부른다 (가짜 글은 e2e/dcinside.ts). */
export const viewPage = (page: Page) => ({
    body: page.locator(".write_div"),
    comments: page.locator(".cmt_list > li"),
    headBadges: page.locator(".gallview_head .refresher-user-badges")
});

/** 갤러리 관리 페이지(/mini/management/)의 디시 요소. */
export const managementPage = (page: Page) => ({
    menu: page.locator(".minor_uadmin_menu")
});
