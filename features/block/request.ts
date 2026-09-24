import type {DetectMode} from "@/core/storage/types";

/** 차단 다이얼로그/컨텍스트에서 만들 extra (v5: [정규식] [갤러리: X] [모드명] 순) */
export const composeExtra = (fields: {isRegex: boolean; gallery?: string; mode?: DetectMode}, modeNames: Record<DetectMode, string>): string =>
    [
        fields.isRegex ? "[정규식]" : "",
        fields.gallery ? `[갤러리: ${fields.gallery}]` : "",
        fields.mode ? `[${modeNames[fields.mode]}]` : ""
    ]
        .filter(Boolean)
        .join(" ");
