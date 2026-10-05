import {EyeOff, Image} from "lucide-react";

import {defineModuleMeta} from "@/core/module/define";

/** 팝업 '이미지 잠시 보이기' 토글. index.ts의 pageToggles가 동작을 붙인다. */
export const REVEAL_TOGGLE = {id: "reveal", label: "이미지 잠시 보이기", icon: Image};

export default defineModuleMeta({
    id: "stealth",
    name: "스텔스 모드",
    description: "페이지 내에서 표시되는 이미지를 비활성화합니다.",
    icon: EyeOff,
    defaultEnable: false,
    toggles: [REVEAL_TOGGLE],
    commands: {
        stealthPause: {description: "이미지 잠시 보이기", key: "Alt+P"}
    }
});
