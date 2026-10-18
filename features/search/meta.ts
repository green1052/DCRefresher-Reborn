import {Search} from "lucide-react";

import {defineModuleMeta} from "@/core/module/define";
import {LIST_PAGE, VIEW_PAGE} from "@/core/pages";

export default defineModuleMeta({
    id: "search",
    name: "검색 이어 보기",
    description: "검색 결과가 한 페이지에 못 미치면 다음 검색 결과를 이어 붙입니다. 검색창에서 아이디·IP로, 유저 메뉴에서 작성글을 찾을 수 있습니다.",
    icon: Search,
    // 글 보기 페이지에도 검색창과 유저 메뉴가 있다. 이어 붙이기는 목록 페이지에서만 한다.
    urls: [LIST_PAGE, VIEW_PAGE],
    defaultEnable: false,

    settings: {
        maxSearches: {
            type: "range",
            name: "최대 다음 검색 횟수",
            desc: "한 번에 이어서 검색할 최대 횟수입니다. 디시는 한 번에 글 1만 개씩 검색합니다.",
            default: 10,
            min: 1,
            max: 30,
            step: 1,
            unit: "회"
        }
    }
});
