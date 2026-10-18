import {resolve} from "node:path";

import {defineWxtModule} from "wxt/modules";

import type {AnyModuleLabels, AnyModuleMeta} from "../core/module/types";
import {featureFolders} from "./lib/features";

/**
 * 모듈 메타(features/<id>/meta.ts)의 commands를 모아 manifest commands로 넣는다.
 * 단축키를 추가할 때 메타·labels.ts와 index.ts의 shortcuts만 고치면 된다. 설명은 labels.ts의 "모듈 이름: 명령 설명"으로 브라우저 단축키 설정에 보인다.
 */
export default defineWxtModule((wxt) => {
    wxt.hook("build:manifestGenerated", async (wxt, manifest) => {
        const folders = featureFolders(wxt.config.root, "meta.ts");
        const files = (file: string) => folders.map((folder) => resolve(wxt.config.root, "features", folder, file));

        const commands: Record<string, { description: string; suggested_key?: { default: string } }> = {};
        // 한 번에 불러온다. 파일마다 부르면 불러오는 환경을 그때마다 새로 만든다. 메타와 표시 문구는 같은 순서(폴더순)로 온다.
        const loaded = await wxt.builder.importEntrypoints([...files("meta.ts"), ...files("labels.ts")]);
        const metas = loaded.slice(0, folders.length) as unknown as AnyModuleMeta[];
        const labels = loaded.slice(folders.length) as unknown as AnyModuleLabels[];
        for (const [index, meta] of metas.entries()) {
            for (const [name, {key}] of Object.entries(meta.commands ?? {})) {
                if (name in commands) throw new Error(`단축키 이름이 겹칩니다: ${name} (${meta.id})`);
                const label = labels[index];
                commands[name] = {description: `${label?.name}: ${label?.commands?.[name]}`, ...(key ? {suggested_key: {default: key}} : {})};
            }
        }
        // dev는 확장 다시 불러오기 명령(dev.reloadCommand)을 이미 넣어 두었으므로 덮지 않고 더한다.
        if (Object.keys(commands).length === 0) return;
        manifest.commands = {...manifest.commands, ...commands};
        // 크롬은 기본 키(suggested_key)가 있는 명령이 4개를 넘으면 확장을 불러오지 않는다. dev 다시 불러오기 명령도 한 자리를 차지한다.
        const keyed = Object.values(manifest.commands).filter((command) => command.suggested_key).length;
        if (keyed > 4) throw new Error(`크롬은 기본 단축키를 4개까지만 받습니다 (지금 ${keyed}개)`);
    });
});
