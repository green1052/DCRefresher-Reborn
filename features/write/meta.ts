import {defineModuleMeta} from "@/core/module/define";
import {WRITE_PAGE} from "@/core/pages";

// 글쓰기의 이미지 버튼이 여는 이미지 올리기 팝업.
const UPLOAD_POPUP = /\/upload\/image/;

export default defineModuleMeta({
    id: "write",
    urls: [WRITE_PAGE, UPLOAD_POPUP],
    defaultEnable: false,

    settings: {
        // 모듈을 켜면 바로 동작하게 기본값을 켠다. 아래 이미지 설정은 올리는 파일이 바뀌므로 직접 켜게 둔다.
        preventExit: {type: "check", default: true},
        webpConvert: {type: "check", default: false},
        webpQuality: {type: "range", default: 80, min: 10, max: 100, step: 5, unit: "%"},
        webpConcurrency: {type: "range", default: 2, min: 1, max: 8, step: 1, unit: "장"},
        obfuscateName: {type: "check", default: false}
    }
});
