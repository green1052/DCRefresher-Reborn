import {existsSync, readdirSync} from "node:fs";
import {resolve} from "node:path";

import {defineWxtModule} from "wxt/modules";

import type {AnyModuleMeta} from "../core/module/types";

/**
 * 모듈 메타(features/<id>/meta.ts)의 commands를 모아 manifest commands로 넣는다.
 * 단축키를 추가할 때 메타와 index.ts의 shortcuts만 고치면 된다. 설명은 "모듈 이름: 명령 설명"으로 브라우저 단축키 설정에 보인다.
 */
export default defineWxtModule((wxt) => {
    wxt.hook("build:manifestGenerated", async (wxt, manifest) => {
        const dir = resolve(wxt.config.root, "features");
        const files = readdirSync(dir, {withFileTypes: true})
            .map((entry) => resolve(dir, entry.name, "meta.ts"))
            .filter((file) => existsSync(file));

        const commands: Record<string, { description: string; suggested_key?: { default: string } }> = {};
        // 한 번에 불러온다. 파일마다 부르면 불러오는 환경을 그때마다 새로 만든다.
        const metas = (await wxt.builder.importEntrypoints(files)) as unknown as AnyModuleMeta[];
        for (const meta of metas) {
            for (const [name, {description, key}] of Object.entries(meta.commands ?? {})) {
                if (name in commands) throw new Error(`단축키 이름이 겹칩니다: ${name} (${meta.id})`);
                commands[name] = {description: `${meta.name}: ${description}`, ...(key ? {suggested_key: {default: key}} : {})};
            }
        }
        if (Object.keys(commands).length > 0) manifest.commands = commands;
    });
});
