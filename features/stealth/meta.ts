import {defineModuleMeta} from "@/core/module/define";

export default defineModuleMeta({
    id: "stealth",
    name: "스텔스 모드",
    description: "페이지에 표시되는 이미지를 숨깁니다.",
    defaultEnable: false,
    toggles: [{id: "reveal", label: "이미지 잠시 보이기"}],
    commands: {
        stealthPause: {description: "이미지 잠시 보이기", key: "Alt+P"}
    }
});
