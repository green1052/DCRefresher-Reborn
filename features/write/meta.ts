import {PenLine} from "lucide-react";

import {defineModuleMeta} from "@/core/module/define";
import type {ModuleIcons} from "@/core/module/types";
import {WRITE_PAGE} from "@/core/pages";

// 글쓰기의 이미지 버튼이 여는 이미지 올리기 팝업.
const UPLOAD_POPUP = /\/upload\/image/;

export default defineModuleMeta({
    id: "write",
    name: "글쓰기",
    description: "글쓰기 페이지를 변경합니다.",
    urls: [WRITE_PAGE, UPLOAD_POPUP],
    defaultEnable: false,

    settings: {
        // 모듈을 켜면 바로 동작하게 기본값을 켠다. 아래 이미지 설정은 올리는 파일이 바뀌므로 직접 켜게 둔다.
        preventExit: {
            type: "check",
            name: "나가기 방지",
            desc: "작성 중인 글이 있으면 페이지를 나가기 전에 확인합니다.",
            default: true
        },
        webpConvert: {
            type: "check",
            name: "이미지 WebP 변환",
            desc: "올리는 이미지를 WebP로 바꿔 용량을 줄입니다. 움직이는 이미지(GIF·APNG)와 WebP·AVIF, WebP로 바꾸면 더 커지는 이미지는 그대로 올립니다.",
            default: false
        },
        webpQuality: {
            type: "range",
            name: "WebP 품질",
            desc: "낮을수록 용량이 줄고 화질이 떨어집니다.",
            default: 80,
            min: 10,
            max: 100,
            step: 5,
            unit: "%"
        },
        webpConcurrency: {
            type: "range",
            name: "동시 변환 수",
            desc: "여러 장을 한꺼번에 바꾸는 수입니다. 높을수록 빠르지만 메모리를 더 씁니다.",
            default: 2,
            min: 1,
            max: 8,
            step: 1,
            unit: "장"
        },
        obfuscateName: {
            type: "check",
            name: "이미지 이름 숨기기",
            desc: "올리는 이미지의 파일 이름을 무작위로 바꿉니다.",
            default: false
        }
    }
});

/** 옵션·팝업이 그리는 아이콘. 콘텐츠 번들에 딸려 가지 않게 기본 export와 따로 둔다 (ModuleIcons). */
export const icons = {module: PenLine} satisfies ModuleIcons;
