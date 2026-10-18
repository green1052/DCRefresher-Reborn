import type {LabelsOf} from "@/core/module/types";

import type meta from "./meta";

/** 옵션·팝업이 보이는 글 (features/meta.ts가 모은다). meta.ts와 따로 두어 배경·콘텐츠 번들에 들어가지 않게 한다. */
export default {
    name: "글쓰기",
    description: "글쓰기 페이지를 변경합니다.",
    settings: {
        preventExit: {name: "나가기 방지", desc: "작성 중인 글이 있으면 페이지를 나가기 전에 확인합니다."},
        webpConvert: {
            name: "이미지 WebP 변환",
            desc: "올리는 이미지를 WebP로 바꿔 용량을 줄입니다. 움직이는 이미지(GIF·APNG)와 WebP·AVIF, WebP로 바꾸면 더 커지는 이미지는 그대로 올립니다."
        },
        webpQuality: {name: "WebP 품질", desc: "낮을수록 용량이 줄고 화질이 떨어집니다."},
        webpConcurrency: {name: "동시 변환 수", desc: "여러 장을 한꺼번에 바꾸는 수입니다. 높을수록 빠르지만 메모리를 더 씁니다."},
        obfuscateName: {name: "이미지 이름 숨기기", desc: "올리는 이미지의 파일 이름을 무작위로 바꿉니다."}
    }
} satisfies LabelsOf<typeof meta>;
