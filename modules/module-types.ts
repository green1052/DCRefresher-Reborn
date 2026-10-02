import {defineWxtModule} from "wxt/modules";

import {featureFolders} from "./lib/features";

/**
 * 기능 모듈의 타입 목록을 만든다. features/<폴더>/index.ts를 모아 ModuleApis(모듈 id → setup의 리턴값)를 채우므로
 * getModuleApi(id)가 id를 자동완성하고 api 타입을 안다. features/<폴더>/meta.ts로는 ModuleSettings(모듈 id → 설정값)를 채워
 * useModuleSettings(id)가 설정 타입을 안다. 새 모듈도 폴더만 만들면 된다 (런타임은 features/index.ts의 glob이 모은다).
 * wxt prepare(설치·dev·build)가 .wxt/types/modules.d.ts로 쓴다.
 */
export default defineWxtModule((wxt) => {
    wxt.hook("prepare:types", (_, entries) => {
        const modules = featureFolders(wxt.config.root, "index.ts").map((folder) => `typeof import("@/features/${folder}/index").default`).join(" | ");
        const metas = featureFolders(wxt.config.root, "meta.ts").map((folder) => `typeof import("@/features/${folder}/meta").default`).join(" | ");

        entries.push({
            path: "types/modules.d.ts",
            text: `import type {ModuleApiMap, ModuleSettingsMap} from "@/core/module/types";\n\ndeclare module "@/core/module/types" {\n` +
                `    interface ModuleApis extends ModuleApiMap<${modules}> {}\n` +
                `    interface ModuleSettings extends ModuleSettingsMap<${metas}> {}\n}\n`,
            tsReference: true
        });
    });
});
