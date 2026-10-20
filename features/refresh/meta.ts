import {defineModuleMeta} from "@/core/module/define";
import type {ModuleContext, SettingsSchema} from "@/core/module/types";
import {BOARD_PAGE} from "@/core/pages";

export const settings = {
    refreshRate: {type: "range", default: 5000, min: 3000, max: 20000, step: 100, unit: "ms"},
    fadeIn: {type: "check", default: true},
    useBetterBrowse: {type: "check", default: true},
    noRefreshOnSearch: {type: "check", default: true},
    pauseOnHover: {type: "check", default: false},
    titleCount: {type: "check", default: true},
    readMark: {type: "check", default: true},
    backgroundRefresh: {type: "check", default: false},
    backgroundRefreshRate: {type: "range", default: 30000, min: 10000, max: 120000, step: 1000, unit: "ms"},
    doNotColorVisited: {type: "check", default: false}
} satisfies SettingsSchema;

export type Ctx = ModuleContext<typeof settings>;

export default defineModuleMeta({
    id: "refresh",
    urls: [BOARD_PAGE],
    settings,
    toggles: ["pause"],
    commands: {
        refreshLists: {key: "Alt+R"},
        refreshPause: {key: "Alt+S"}
    }
});
