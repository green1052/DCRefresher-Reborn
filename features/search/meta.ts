import {Search} from "lucide-react";

import {defineModuleMeta} from "@/core/module/define";
import {LIST_PAGE} from "@/core/pages";

export default defineModuleMeta({
    id: "search",
    name: "검색 이어 보기",
    description: "검색 결과가 한 페이지에 못 미치면 다음 검색 결과를 이어 붙입니다.",
    icon: Search,
    urls: [LIST_PAGE],
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
