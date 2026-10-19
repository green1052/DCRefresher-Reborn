import type {LabelsOf, SettingGroup, SettingLabel} from "@/core/module/types";

import type meta from "./meta";
import type {BadgeColor} from "./meta";

/** 배지 이름. 배지 색 설정(`${key}Color`)의 이름·설명이 된다. */
const BADGE_NAMES = {
    uid: "아이디/IP",
    ratio: "글댓비",
    ratioAlarm: "깡계",
    permBan: "갱차",
    korea: "IP 한국",
    japan: "IP 일본",
    china: "IP 중국",
    foreign: "IP 그 외 해외",
    vpn: "IP VPN"
} satisfies Record<BadgeColor, string>;

const LOW_ACTIVITY_GROUP: SettingGroup = {name: "깡계", desc: "글댓합이 기준 이하인 유저를 깡계로 봅니다. 글댓비 표시가 켜져 있고 글댓비를 받아 둔 유저만 해당합니다. 기준이 0이면 꺼집니다."};

const BADGE_COLOR_GROUP: SettingGroup = {name: "배지 색", desc: "유저 정보 배지의 글자 색입니다. IP는 국가별로 칠하고, VPN이면 국가보다 우선합니다."};

/** 옵션·팝업이 보이는 글 (features/meta.ts가 모은다). meta.ts와 따로 두어 배경·콘텐츠 번들에 들어가지 않게 한다. */
export default {
    name: "유저 정보",
    description: "유저의 IP, 아이디 정보, 메모를 표시합니다.",
    settings: {
        showFixedNickUID: {name: "고정닉 아이디 표시", desc: "고정닉 유저의 아이디를 표시합니다."},
        showHalfFixedNickUID: {name: "반고정닉 아이디 표시", desc: "반고정닉 유저의 아이디를 표시합니다."},
        ipInfoFilter: {
            name: "IP 정보 표시",
            desc: "IP의 통신사·조직과 국가를 표시할 대상입니다. VPN은 국가와 상관없이 해외·VPN에 들어갑니다. " +
                "표시되는 정보는 공개 IP 데이터로 추정한 값이라 실제와 다를 수 있습니다."
        },
        checkRatio: {
            name: "글댓비 표시",
            desc: "작성자의 글/댓글 수를 표시합니다. 자동 새로고침으로 새로 올라온 글과 미리보기로 연 글의 작성자만 조회합니다. " +
                "조회한 값(미리보기·유저 버블로 본 작성자 포함)은 저장해 두고 목록에 계속 표시하며 깡계 처리에도 씁니다. 1시간이 지난 값은 그 유저의 새 글이 올라오면 다시 조회합니다."
        },
        alarmRatio: {group: LOW_ACTIVITY_GROUP, name: "기준", desc: "글댓합이 이 값 이하면 깡계로 봅니다. (0이면 끔)"},
        lowActivityAction: {group: LOW_ACTIVITY_GROUP, name: "처리", desc: "깡계 유저의 글·댓글을 어떻게 보여 줄지 정합니다."},
        checkPermBan: {name: "갱차 조회", desc: "갱차(갱신 차단)된 갤러리를 배지로 표시합니다. (IP/밴 데이터베이스 기준)"},
        ...(Object.fromEntries(
            Object.entries(BADGE_NAMES).map(([key, name]) => [`${key}Color`, {group: BADGE_COLOR_GROUP, name, desc: `${name} 배지의 글자 색입니다.`}])
        ) as Record<`${BadgeColor}Color`, SettingLabel>),
        badgeOrder: {name: "정보 배치 순서", desc: "유저 정보 배지의 표시 순서를 정합니다."}
    }
} satisfies LabelsOf<typeof meta>;
