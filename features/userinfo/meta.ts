import type {IpCategory, IpInfoFilter} from "@/core/database";
import {defineModuleMeta} from "@/core/module/define";
import type {ModuleContext, SettingSchema, SettingsSchema} from "@/core/module/types";
import {BOARD_PAGE} from "@/core/pages";

/**
 * 배지 색 기본값. 키마다 `${key}Color` 설정이 하나씩 생기고 옵션 화면에선 한 그룹으로 묶인다 (이름은 labels.ts의 BADGE_NAMES).
 * IP 배지는 분류(korea…vpn)가 키다.
 */
export const BADGE_COLORS = {
    uid: "#999999",
    ratio: "#999999",
    ratioAlarm: "#ff0000",
    permBan: "#e8645f",
    korea: "#6495ed",
    japan: "#e5484d",
    china: "#f76b15",
    foreign: "#12a594",
    vpn: "#8e4ec6"
} satisfies Record<IpCategory | "uid" | "permBan" | "ratio" | "ratioAlarm", string>;

export type BadgeColor = keyof typeof BADGE_COLORS;

const IP_INFO_FILTERS: Record<IpInfoFilter, string> = {all: "전체", foreign: "해외·VPN만", vpn: "VPN만", none: "표시 안 함"};

const LOW_ACTIVITY_ACTIONS = {none: "배지 색만", tag: "[깡계] 표시", blur: "흐리게", hide: "숨기기"};

export const settings = {
    showFixedNickUID: {type: "check", default: true},
    showHalfFixedNickUID: {type: "check", default: true},
    ipInfoFilter: {type: "option", default: "all", items: IP_INFO_FILTERS},
    checkRatio: {type: "check", default: false},
    alarmRatio: {type: "range", default: 0, min: 0, max: 5000, step: 10, unit: "개"},
    lowActivityAction: {type: "option", default: "tag", items: LOW_ACTIVITY_ACTIONS},
    checkPermBan: {type: "check", default: false},
    ...(Object.fromEntries(Object.entries(BADGE_COLORS).map(([key, color]) => [`${key}Color`, {type: "color", default: color}])) as
        Record<`${BadgeColor}Color`, Extract<SettingSchema, { type: "color" }>>),
    badgeOrder: {
        type: "order",
        items: {UID: "아이디/IP", MEMO: "메모", RATIO: "글댓비", PERMBAN: "갱차"},
        default: ["UID", "MEMO", "RATIO", "PERMBAN"]
    }
} satisfies SettingsSchema;

export type Ctx = ModuleContext<typeof settings>;

export default defineModuleMeta({
    id: "userinfo",
    urls: [BOARD_PAGE],
    settings
});
