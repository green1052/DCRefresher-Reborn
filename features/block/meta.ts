import {defineModuleMeta} from "@/core/module/define";
import type {ModuleContext, SettingsSchema} from "@/core/module/types";
import {BOARD_PAGE} from "@/core/pages";

export const settings = {
    replyRemove: {type: "check", default: false},
    blur: {type: "check", default: false},
    blurReveal: {type: "check", default: true},
    blurStrength: {type: "range", default: 5, min: 1, max: 20, step: 1, unit: "px"},
    similarImages: {type: "check", default: false},
    similarThreshold: {type: "range", default: 12, min: 4, max: 16, step: 1, unit: "칸"},
    foldDuplicate: {type: "check", default: false},
    duplicateCount: {type: "range", default: 3, min: 2, max: 10, step: 1, unit: "번"},
    duplicateMinLength: {type: "range", default: 5, min: 1, max: 50, step: 1, unit: "자"}
} satisfies SettingsSchema;

export type Ctx = ModuleContext<typeof settings>;

export default defineModuleMeta({
    id: "block",
    urls: [BOARD_PAGE],
    settings,
    toggles: ["reveal"],
    commands: {blockReveal: {}}
});
