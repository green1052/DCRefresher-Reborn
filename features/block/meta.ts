import {Ban, Eye} from "lucide-react";

import {defineModuleMeta} from "@/core/module/define";
import type {ModuleContext} from "@/core/module/types";
import {BOARD_PAGE} from "@/core/pages";

import {BLOCK_SETTINGS} from "./settings";

// 설정은 배경(background.ts)도 쓰므로 settings.ts에 둔다.
export type Ctx = ModuleContext<typeof BLOCK_SETTINGS>;

/** 팝업 '가린 내용 보기' 토글. index.ts의 pageToggles가 동작을 붙인다. */
export const REVEAL_TOGGLE = {id: "reveal", label: "가린 내용 보기", icon: Eye};

export default defineModuleMeta({
    id: "block",
    name: "콘텐츠 차단",
    description: "보고 싶지 않은 유저·글·댓글을 숨기거나 흐리게 합니다.",
    icon: Ban,
    urls: [BOARD_PAGE],
    settings: BLOCK_SETTINGS,
    toggles: [REVEAL_TOGGLE],
    commands: {
        blockReveal: {description: "이 페이지에서 가린 내용 보기"}
    }
});
