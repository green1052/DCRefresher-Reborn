import {ScanSearch} from "lucide-react";

import {defineModule} from "@/core/module/define";

import {IMAGE_SEARCH_ID, IMAGE_SEARCH_SETTINGS} from "./engines";

export default defineModule({
    id: IMAGE_SEARCH_ID,
    name: "이미지 검색",
    description: "디시 이미지를 우클릭해 검색 엔진에서 찾습니다.",
    icon: ScanSearch,
    settings: IMAGE_SEARCH_SETTINGS,

    // 메뉴는 배경이 이 모듈의 on/off·설정을 보고 만들고, 누르면 새 탭으로 연다 — 페이지에서 할 일은 없다
    setup() {}
});
