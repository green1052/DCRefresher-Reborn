import {defineModuleMeta} from "@/core/module/define";

export default defineModuleMeta({
    id: "stealth",
    defaultEnable: false,
    toggles: ["reveal"],
    commands: {
        stealthPause: {key: "Alt+P"}
    }
});
