import {defineWxtModule} from "wxt/modules";

import {featureFolders} from "./lib/features";

/**
 * wxt prepare(설치·dev·build) 때 기능 모듈의 타입을 만든다. 런타임 목록은 features/index.ts의 glob이 모은다.
 * - .wxt/types/modules.d.ts: features/<폴더>/index.ts로 ModuleApis(id → setup 리턴값)를, meta.ts로 ModuleSettings(id → 설정값)를 채워
 *   getModuleApi(id)·useModuleSettings(id)가 타입을 안다.
 * - .wxt/module-ids.ts: meta.ts가 있는 폴더 이름(= id) 목록. 배경도 쓰는 백업(core/backup.ts)이 메타를 모두 불러오지 않고(모든 모듈의 설정 스키마가 배경 번들에 딸려 간다) 모듈을 알게 한다.
 */
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
            text: `// modules/module-types.ts가 만든다. 고치지 않는다.\nexport default ${JSON.stringify(metaFolders)};\n`
        });
    });
});
