import {UserRound} from "lucide-react";

import type {IpInfoFilter} from "@/core/database";
import {defineModuleMeta} from "@/core/module/define";
import type {ModuleContext, SettingGroup, SettingSchema, SettingsSchema} from "@/core/module/types";
import {BOARD_PAGE} from "@/core/pages";
import type {BadgeColorKey} from "@/stores/ui";

/** 배지 색 기본값. 키마다 `${key}Color` 설정이 하나씩 생기고 옵션 화면에선 한 그룹으로 묶인다. IP 배지는 분류(korea…vpn)가 키다. */
export const BADGE_COLORS = {
    uid: ["아이디/IP", "#999999"],
    ratio: ["글댓비", "#999999"],
    ratioAlarm: ["깡계", "#ff0000"],
    permBan: ["갱차", "#e8645f"],
    korea: ["IP 한국", "#6495ed"],
    japan: ["IP 일본", "#e5484d"],
    china: ["IP 중국", "#f76b15"],
    foreign: ["IP 그 외 해외", "#12a594"],
    vpn: ["IP VPN", "#8e4ec6"]
} satisfies Record<BadgeColorKey, [name: string, color: string]>;

export type BadgeColor = keyof typeof BADGE_COLORS;

const LOW_ACTIVITY_GROUP: SettingGroup = {name: "깡계", desc: "글댓합이 기준 이하인 유저를 깡계로 봅니다. 글댓비 표시가 켜져 있고 글댓비를 받아 둔 유저만 해당합니다. 기준이 0이면 꺼집니다."};

const BADGE_COLOR_GROUP: SettingGroup = {name: "배지 색", desc: "유저 정보 배지의 글자 색입니다. IP는 국가별로 칠하고, VPN이면 국가보다 우선합니다."};

const IP_INFO_FILTERS: Record<IpInfoFilter, string> = {all: "전체", foreign: "해외·VPN만", vpn: "VPN만", none: "표시 안 함"};

const LOW_ACTIVITY_ACTIONS = {none: "배지 색만", tag: "[깡계] 표시", blur: "흐리게", hide: "숨기기"};

export const settings = {
    showFixedNickUID: {
        type: "check",
        name: "고정닉 아이디 표시",
        desc: "고정닉 유저의 아이디를 표시합니다.",
        default: true
    },
    showHalfFixedNickUID: {
        type: "check",
        name: "반고정닉 아이디 표시",
        desc: "반고정닉 유저의 아이디를 표시합니다.",
        default: true
    },
    ipInfoFilter: {
        type: "option",
        name: "IP 정보 표시",
        desc: "IP의 통신사·조직과 국가를 표시할 대상입니다. VPN은 국가와 상관없이 해외·VPN에 들어갑니다. " +
            "표시되는 정보는 공개 IP 데이터로 추정한 값이라 실제와 다를 수 있습니다.",
        default: "all",
        items: IP_INFO_FILTERS
    },
    checkRatio: {
        type: "check",
        name: "글댓비 표시",
        desc: "작성자의 글/댓글 수를 표시합니다. 자동 새로고침으로 새로 올라온 글과 미리보기로 연 글의 작성자만 조회합니다. " +
            "새 글 작성자의 값은 저장해 두고 목록에 계속 표시하며, 1시간이 지난 값은 그 유저의 새 글이 올라오면 다시 조회합니다.",
        default: false
    },
    alarmRatio: {
        type: "range",
        group: LOW_ACTIVITY_GROUP,
        name: "기준",
        desc: "글댓합이 이 값 이하면 깡계로 봅니다. (0이면 끔)",
        default: 0,
        min: 0,
        max: 5000,
        step: 10,
        unit: "개"
    },
    lowActivityAction: {
        type: "option",
        group: LOW_ACTIVITY_GROUP,
        name: "처리",
        desc: "깡계 유저의 글·댓글을 어떻게 보여 줄지 정합니다.",
        default: "tag",
        items: LOW_ACTIVITY_ACTIONS
    },
    checkPermBan: {
        type: "check",
        name: "갱차 조회",
        desc: "갱차(갱신 차단)된 갤러리를 배지로 표시합니다. (IP/밴 데이터베이스 기준)",
        default: false
    },
    ...(Object.fromEntries(
        Object.entries(BADGE_COLORS).map(([key, [name, color]]) => [
            `${key}Color`,
            {type: "color", group: BADGE_COLOR_GROUP, name, desc: `${name} 배지의 글자 색입니다.`, default: color}
        ])
    ) as Record<`${BadgeColor}Color`, Extract<SettingSchema, { type: "color" }>>),
    badgeOrder: {
        type: "order",
        name: "정보 배치 순서",
        desc: "유저 정보 배지의 표시 순서를 정합니다.",
        items: {UID: "아이디/IP", MEMO: "메모", RATIO: "글댓비", PERMBAN: "갱차"},
        default: ["UID", "MEMO", "RATIO", "PERMBAN"]
    }
} satisfies SettingsSchema;

export type Ctx = ModuleContext<typeof settings>;

export default defineModuleMeta({
    id: "userinfo",
    name: "유저 정보",
    description: "유저의 IP, 아이디 정보, 메모를 표시합니다.",
    icon: UserRound,
    urls: [BOARD_PAGE],
    settings
});
