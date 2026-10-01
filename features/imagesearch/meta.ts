import {ScanSearch} from "lucide-react";

import {defineModuleMeta} from "@/core/module/define";

import {IMAGE_SEARCH_ID, IMAGE_SEARCH_SETTINGS} from "./engines";

export default defineModuleMeta({
    id: IMAGE_SEARCH_ID,
    name: "이미지 검색",
    description: "디시 이미지를 우클릭해 검색 엔진에서 찾습니다.",
    icon: ScanSearch,
    // 메뉴는 background.ts가 만들고 처리한다. 페이지에선 할 일이 없어 index.ts를 두지 않는다 (콘텐츠 스크립트가 이 모듈을 등록하지 않는다).
    settings: IMAGE_SEARCH_SETTINGS
});
