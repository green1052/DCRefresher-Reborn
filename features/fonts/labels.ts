import type {LabelsOf} from "@/core/module/types";

import type meta from "./meta";

/** 옵션·팝업이 보이는 글 (features/meta.ts가 모은다). meta.ts와 따로 두어 배경·콘텐츠 번들에 들어가지 않게 한다. */
export default {
    name: "폰트 교체",
    description: "페이지 전반의 폰트를 교체합니다.",
    settings: {
        customFonts: {name: "폰트 이름", desc: "쉼표로 구분한 폰트 이름입니다. 앞의 폰트가 없으면 다음 폰트를 씁니다. (빈칸이면 기본 폰트)"},
        changeDCFont: {name: "디시인사이드 폰트 교체", desc: "미리보기 창 같은 DCRefresher Reborn의 폰트뿐만 아니라 디시인사이드의 폰트와 본문 크기까지 바꿉니다."},
        bodyFontSize: {name: "본문 폰트 크기", desc: "게시글 본문의 폰트 크기입니다. 미리보기 창은 본문과 댓글 모두 +2px로 표시됩니다."}
    }
} satisfies LabelsOf<typeof meta>;
