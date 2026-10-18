import type {LabelsOf} from "@/core/module/types";

import type meta from "./meta";

/** 옵션·팝업이 보이는 글 (features/meta.ts가 모은다). meta.ts와 따로 두어 배경·콘텐츠 번들에 들어가지 않게 한다. */
export default {
    name: "검색",
    description: "검색 결과가 한 쪽에 못 미치면 다음 구간을 이어 붙이고, 아이디·IP로 한 사람의 글을 찾습니다.",
    settings: {
        maxSearches: {name: "최대 다음 검색 횟수", desc: "한 번에 이어서 검색할 최대 횟수입니다."}
    }
} satisfies LabelsOf<typeof meta>;
