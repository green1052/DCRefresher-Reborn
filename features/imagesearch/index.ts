import {ScanSearch} from "lucide-react";

import {defineModule} from "@/core/module/define";

import {IMAGE_SEARCH_ID, IMAGE_SEARCH_SETTINGS} from "./engines";

export default defineModule({
    id: IMAGE_SEARCH_ID,
    name: "이미지 검색",
    description: "디시 이미지를 우클릭해 검색 엔진에서 찾습니다.",
    icon: ScanSearch,
    // 메뉴는 background.ts가 만들고 처리한다. 페이지에서 할 일이 없으므로 어느 페이지에서도 돌지 않게 해 설정을 읽거나 감시하지 않는다
    urls: [],
    settings: IMAGE_SEARCH_SETTINGS,

    setup() {}
});
