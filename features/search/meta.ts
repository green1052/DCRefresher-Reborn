import {defineModuleMeta} from "@/core/module/define";
import {LIST_PAGE, VIEW_PAGE} from "@/core/pages";

export default defineModuleMeta({
    id: "search",
    // 글 보기 페이지에도 검색창과 유저 메뉴가 있다. 이어 붙이기는 목록 페이지에서만 한다.
    urls: [LIST_PAGE, VIEW_PAGE],
    defaultEnable: false,

    settings: {
        maxSearches: {type: "range", default: 10, min: 1, max: 30, step: 1, unit: "회"}
    }
});
