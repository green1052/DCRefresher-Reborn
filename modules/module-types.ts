import {defineWxtModule} from "wxt/modules";

import {featureFolders} from "./lib/features";

/** prepare 때 기능 모듈 타입(.wxt/types/modules.d.ts)과 id 목록(.wxt/module-ids.ts)을 만든다. */
export default defineWxtModule((wxt) => {
    wxt.hook("prepare:types", (_, entries) => {
        const metaFolders = featureFolders(wxt.config.root, "meta.ts");
        const modules = featureFolders(wxt.config.root, "index.ts").map((folder) => `typeof import("@/features/${folder}/index").default`).join(" | ");
        const metas = metaFolders.map((folder) => `typeof import("@/features/${folder}/meta").default`).join(" | ");

        entries.push({
            path: "types/modules.d.ts",
            text: `import type {ModuleApiMap, ModuleSettingsMap} from "@/core/module/types";\n\ndeclare module "@/core/module/types" {\n` +
                `    interface ModuleApis extends ModuleApiMap<${modules}> {}\n` +
                `    interface ModuleSettings extends ModuleSettingsMap<${metas}> {}\n}\n`,
            tsReference: true
        }, {
            path: "module-ids.ts",
            text: `export default ${JSON.stringify(metaFolders)};\n`
        });
    });
});
