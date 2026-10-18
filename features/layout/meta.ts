import {defineModuleMeta} from "@/core/module/define";
import type {ModuleContext, SettingSchema, SettingsSchema} from "@/core/module/types";
import {objectKeys} from "@/utils/typed";

/** 체크하면 숨기는 영역. 설정과 <style> 규칙을 모두 여기서 만들므로 새 항목은 여기 한 줄과 labels.ts의 이름·설명만 추가하면 된다. */
export const HIDE_OPTIONS = {
    hideGalleryView: {selector: ".issue_wrap, #visit_history"},
    hideUselessView: {selector: "section.right_content article"},
    hideGalleryImage: {selector: "#zzbang_div"},
    removeNotice: {selector: "tr:has(em[class*=icon_notice])"},
    removeDCNotice: {
        // 설문·광고 행은 user_name 칸, 운영자 글은 식별 코드·IP가 빈 운영자 작성자 칸.
        selector: "tr[class*=ub-content]:has(> td[user_name=운영자]), tr.ub-content:has(> .ub-writer[data-nick=운영자][data-uid=\"\"][data-ip=\"\"])"
    },
    removeGamemeca: {
        // 옛 뉴스 행과, 일반 글 행으로 그려지는 게임메카 작성자 행을 둘 다 잡는다.
        selector: "tr[data-type=icon_fnews], tr.ub-content:has(> .ub-writer[data-uid=\"gamemeca\"])"
    },
    removeAi: {selector: "tr[data-type=icon_ai]"}
} satisfies Record<string, { selector: string }>;

export const HIDE_KEYS = objectKeys(HIDE_OPTIONS);

export const settings = {
    activePixel: {
        type: "range",
        default: 900,
        min: 100,
        // 모니터마다 다른 screen.width로 두면 큰 모니터에서 저장한 값이 작은 모니터에서 잘린다.
        max: 3840,
        step: 1,
        unit: "px"
    },
    forceCompact: {type: "check", default: false},
    useCompactModeOnView: {type: "check", default: true},
    ...(Object.fromEntries(HIDE_KEYS.map((key) => [key, {type: "check", default: false}])) as
        Record<(typeof HIDE_KEYS)[number], Extract<SettingSchema, { type: "check" }>>),
    pushToRight: {type: "check", default: false}
} satisfies SettingsSchema;

export type Ctx = ModuleContext<typeof settings>;

export default defineModuleMeta({
    id: "layout",
    settings
});
