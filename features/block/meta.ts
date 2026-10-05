import {Ban, Eye} from "lucide-react";

import {defineModuleMeta} from "@/core/module/define";
import type {ModuleContext, SettingGroup, SettingsSchema} from "@/core/module/types";
import {BOARD_PAGE} from "@/core/pages";

const BLUR_GROUP: SettingGroup = {name: "흐리게 처리", desc: "차단된 내용을 숨기지 않고 흐리게 처리합니다."};

const DUPLICATE_GROUP: SettingGroup = {name: "같은 댓글 접기", desc: "같은 내용의 댓글이 여러 번 달리면 첫 댓글만 남기고 접습니다. 미리보기에도 적용됩니다."};

export const settings = {
    replyRemove: {
        type: "check",
        name: "대댓글도 가리기",
        desc: "차단된 댓글의 대댓글도 함께 가립니다.",
        default: false
    },
    blur: {
        type: "check",
        group: BLUR_GROUP,
        name: "사용",
        desc: "차단된 내용을 흐리게 처리합니다.",
        default: false
    },
    blurReveal: {
        type: "check",
        group: BLUR_GROUP,
        name: "마우스를 올리면 보기",
        desc: "흐리게 처리된 내용에 마우스를 올린 동안 원래대로 보여 줍니다.",
        default: true
    },
    blurStrength: {
        type: "range",
        group: BLUR_GROUP,
        name: "강도",
        desc: "차단된 내용을 흐리게 하는 정도입니다.",
        default: 5,
        min: 1,
        max: 20,
        step: 1,
        unit: "px"
    },
    foldDuplicate: {
        type: "check",
        group: DUPLICATE_GROUP,
        name: "사용",
        desc: "같은 댓글을 한 줄로 접습니다.",
        default: false
    },
    duplicateCount: {
        type: "range",
        group: DUPLICATE_GROUP,
        name: "반복 횟수",
        desc: "이만큼 반복되면 접습니다.",
        default: 3,
        min: 2,
        max: 10,
        step: 1,
        unit: "번"
    },
    duplicateMinLength: {
        type: "range",
        group: DUPLICATE_GROUP,
        name: "최소 글자 수",
        desc: "이보다 짧은 댓글(ㅋㅋ 등)은 반복돼도 접지 않습니다.",
        default: 5,
        min: 1,
        max: 50,
        step: 1,
        unit: "자"
    }
} satisfies SettingsSchema;

export type Ctx = ModuleContext<typeof settings>;

/** 팝업 '가린 내용 보기' 토글. index.ts의 pageToggles가 동작을 붙인다. */
export const REVEAL_TOGGLE = {id: "reveal", label: "가린 내용 보기", icon: Eye};

export default defineModuleMeta({
    id: "block",
    name: "콘텐츠 차단",
    description: "보고 싶지 않은 유저·글·댓글을 숨기거나 흐리게 합니다.",
    icon: Ban,
    urls: [BOARD_PAGE],
    settings,
    toggles: [REVEAL_TOGGLE],
    commands: {
        blockReveal: {description: "이 페이지에서 가린 내용 보기"}
    }
});
