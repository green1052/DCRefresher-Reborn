import type {LabelsOf} from "@/core/module/types";

import type meta from "./meta";

/** 옵션·팝업이 보이는 글 (features/meta.ts가 모은다). meta.ts와 따로 두어 배경·콘텐츠 번들에 들어가지 않게 한다. */
export default {
    name: "요청 제한",
    description: "디시인사이드로 한꺼번에 보내는 요청 수를 제한합니다. 요청이 몰려 차단되지 않게 합니다.",
    settings: {
        concurrency: {name: "동시 요청 수", desc: "이 페이지에서 한 번에 보내는 요청의 최대 개수입니다. 넘치는 요청은 앞의 요청이 끝날 때까지 기다립니다."}
    }
} satisfies LabelsOf<typeof meta>;
