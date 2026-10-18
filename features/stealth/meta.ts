import {EyeOff, Image} from "lucide-react";

import {defineModuleMeta} from "@/core/module/define";
import type {ModuleIcons} from "@/core/module/types";

/** 팝업 '이미지 잠시 보이기' 토글. index.ts의 pageToggles가 동작을 붙인다. */
export const REVEAL_TOGGLE = {id: "reveal", label: "이미지 잠시 보이기"} as const;

export default defineModuleMeta({
    id: "stealth",
    name: "스텔스 모드",
    description: "페이지에 표시되는 이미지를 숨깁니다.",
    defaultEnable: false,
    toggles: [REVEAL_TOGGLE],
    commands: {
        stealthPause: {description: "이미지 잠시 보이기", key: "Alt+P"}
    }
});

/** 옵션·팝업이 그리는 아이콘. 콘텐츠 번들에 딸려 가지 않게 기본 export와 따로 둔다 (ModuleIcons). */
export const icons = {module: EyeOff, toggles: {reveal: Image}} satisfies ModuleIcons<typeof REVEAL_TOGGLE.id>;
