import {LayoutPanelTop} from "lucide-react";

import {defineModuleMeta} from "@/core/module/define";
import type {ModuleContext, SettingSchema, SettingsSchema} from "@/core/module/types";
import {objectKeys} from "@/utils/typed";

/** 체크하면 숨기는 영역. 설정과 <style> 규칙을 모두 여기서 만드므로 새 항목은 한 줄만 추가하면 된다. */
export const HIDE_OPTIONS = {
    hideGalleryView: {name: "갤러리 뷰 숨기기", desc: "갤러리 정보, 최근 방문 갤러리 영역을 숨깁니다.", selector: ".issue_wrap, #visit_history"},
    hideUselessView: {
        name: "잡다 링크 숨기기",
        desc: "이슈줌, 타갤 개념글, 뉴스, 힛갤 등의 콘텐츠를 오른쪽 영역에서 숨깁니다.",
        selector: "section.right_content article"
    },
    hideGalleryImage: {name: "갤러리 대문 숨기기", desc: "갤러리 대문을 숨깁니다.", selector: "#zzbang_div"},
    removeNotice: {name: "갤러리 공지 숨기기", desc: "글 목록에서 공지사항을 숨깁니다.", selector: "tr:has(em[class*=icon_notice])"},
    removeDCNotice: {
        name: "디시 공지 숨기기",
        desc: "글 목록에서 운영자의 게시글을 숨깁니다.",
        // 설문·광고 행은 user_name 칸, 운영자 글은 식별 코드·IP가 빈 운영자 작성자 칸.
        selector: "tr[class*=ub-content]:has(> td[user_name=운영자]), tr.ub-content:has(> .ub-writer[data-nick=운영자][data-uid=\"\"][data-ip=\"\"])"
    },
    removeGamemeca: {
        name: "게임메카 숨기기",
        desc: "글 목록에서 게임메카 게시글을 숨깁니다.",
        // 옛 뉴스 행과, 일반 글 행으로 그려지는 게임메카 작성자 행을 둘 다 잡는다.
        selector: "tr[data-type=icon_fnews], tr.ub-content:has(> .ub-writer[data-uid=\"gamemeca\"])"
    },
    removeAi: {name: "AI 글 숨기기", desc: "글 목록에서 AI 표시가 붙은 글을 숨깁니다.", selector: "tr[data-type=icon_ai]"}
} satisfies Record<string, { name: string; desc: string; selector: string }>;

export const HIDE_KEYS = objectKeys(HIDE_OPTIONS);

export const settings = {
    activePixel: {
        type: "range",
        name: "컴팩트 모드 활성화 조건",
        desc: "브라우저 가로가 이 값보다 작을 경우 컴팩트 모드를 활성화합니다.",
        default: 900,
        min: 100,
        // 모니터마다 다른 screen.width로 두면 큰 모니터에서 저장한 값이 작은 모니터에서 잘린다.
        max: 3840,
        step: 1,
        unit: "px"
    },
    forceCompact: {
        type: "check",
        name: "컴팩트 모드 강제 사용",
        desc: "항상 컴팩트 모드를 사용합니다.",
        default: false
    },
    useCompactModeOnView: {
        type: "check",
        name: "게시글 보기 컴팩트 모드",
        desc: "게시글 보기에서도 컴팩트 모드를 사용합니다.",
        default: true
    },
    ...(Object.fromEntries(HIDE_KEYS.map((key) => [key, {type: "check", name: HIDE_OPTIONS[key].name, desc: HIDE_OPTIONS[key].desc, default: false}])) as
        Record<(typeof HIDE_KEYS)[number], Extract<SettingSchema, { type: "check" }>>),
    pushToRight: {
        type: "check",
        name: "본문 영역 전체로 확장",
        desc: "\"잡다 링크 숨기기\" 옵션이 켜진 경우 본문 영역을 확장합니다.",
        default: false
    }
} satisfies SettingsSchema;

export type Ctx = ModuleContext<typeof settings>;

export default defineModuleMeta({
    id: "layout",
    name: "레이아웃 수정",
    description: "디시 레이아웃을 변경합니다.",
    icon: LayoutPanelTop,

    settings
});
