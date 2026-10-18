import {Search} from "lucide-react";

import {defineModuleMeta} from "@/core/module/define";
import type {ModuleIcons} from "@/core/module/types";
import {LIST_PAGE, VIEW_PAGE} from "@/core/pages";

export default defineModuleMeta({
    id: "search",
    name: "검색",
    description: "검색 결과가 한 쪽에 못 미치면 다음 구간을 이어 붙이고, 아이디·IP로 한 사람의 글을 찾습니다.",
    // 글 보기 페이지에도 검색창과 유저 메뉴가 있다. 이어 붙이기는 목록 페이지에서만 한다.
    urls: [LIST_PAGE, VIEW_PAGE],
    defaultEnable: false,

    settings: {
        maxSearches: {
            type: "range",
            name: "최대 다음 검색 횟수",
            desc: "한 번에 이어서 검색할 최대 횟수입니다.",
            default: 10,
            min: 1,
            max: 30,
            step: 1,
            unit: "회"
        }
    }
});

/** 옵션·팝업이 그리는 아이콘. 콘텐츠 번들에 딸려 가지 않게 기본 export와 따로 둔다 (ModuleIcons). */
export const icons = {module: Search} satisfies ModuleIcons;
