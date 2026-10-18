import type {LabelsOf} from "@/core/module/types";

import type meta from "./meta";

/** 옵션·팝업이 보이는 글 (features/meta.ts가 모은다). meta.ts와 따로 두어 배경·콘텐츠 번들에 들어가지 않게 한다. */
export default {
    name: "스텔스 모드",
    description: "페이지에 표시되는 이미지를 숨깁니다.",
    toggles: {reveal: "이미지 잠시 보이기"},
    commands: {stealthPause: "이미지 잠시 보이기"}
} satisfies LabelsOf<typeof meta>;
