import {defineModuleMeta} from "@/core/module/define";

export default defineModuleMeta({
    id: "requests",
    settings: {
        concurrency: {type: "range", default: 4, min: 1, max: 10, step: 1, unit: "개"}
    }
});
