import {defineModuleMeta} from "@/core/module/define";
import type {ModuleContext, SettingsSchema} from "@/core/module/types";
import {BOARD_PAGE} from "@/core/pages";
import {BLOCK_DAYS} from "@/core/preview/types";

// "v5와 같은 키"는 v5에서 옮긴 값을 그대로 쓰므로 이름을 바꾸지 않는다.

export const settings = {
    previewWidth: {type: "range", default: 1200, min: 700, max: 1600, step: 50, unit: "px"},
    // v5와 같은 키.
    toggleBackgroundBlur: {type: "check", default: true},
    popupBlur: {type: "check", default: true},
    // v5와 같은 키.
    scrollToSkip: {type: "check", default: true},
    tooltipMode: {type: "check", default: false},
    tooltipMediaHide: {type: "check", default: false},
    tooltipDelay: {
        type: "range",
        // 이 시간 동안 제목 위에 머물러야 글을 받는다. 짧으면 목록을 훑을 때 지나는 행마다 요청이 나가 디시가 임시 차단한다.
        default: 300,
        min: 200,
        max: 1000,
        step: 50,
        unit: "ms"
    },
    // v5와 같은 키 ('툴팁 미리보기 상호작용').
    tooltipInteraction: {type: "check", default: false},
    reversePreviewKey: {type: "check", default: false},
    longPressDelay: {type: "range", default: 300, min: 200, max: 2000, step: 50, unit: "ms"},
    colorPreviewLink: {type: "check", default: true},
    autoRefreshComment: {type: "check", default: false},
    highlightNewComments: {type: "check", default: true},
    commentRefreshInterval: {type: "range", default: 10000, min: 3000, max: 20000, step: 100, unit: "ms"},
    toggleAdminPanel: {type: "check", default: true},
    useKeyPress: {type: "check", default: true},
    deleteKey: {type: "key", default: "d"},
    blockKey: {type: "key", default: "b"},
    blockPresetDay: {type: "option", default: "1", items: BLOCK_DAYS},
    blockPresetDelete: {type: "check", default: false},
    blockPresetUserType: {type: "check", default: false},
    blockPresetReason: {
        type: "text",
        default: "",
        // 직접 차단 창(Popups.tsx)의 사유 입력칸과 같은 상한.
        maxLength: 20
    },
    expandRecognizeRange: {type: "check", default: false},
    imageViewer: {type: "check", default: true},
    listKeyboard: {type: "check", default: true},
    disableCache: {type: "check", default: false},
    archiveArticle: {type: "check", default: false},
    blockImage: {type: "check", default: false}
} satisfies SettingsSchema;

export type Ctx = ModuleContext<typeof settings>;

export default defineModuleMeta({
    id: "preview",
    urls: [BOARD_PAGE],
    settings
});
