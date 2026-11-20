import {resolve} from "node:path";
import {defineWxtModule} from "wxt/modules";

import {featureFolders} from "./lib/features";

/** features/<id>/page.ts는 모듈이 탭의 페이지(MAIN world)에 넣는 스크립트다. page.css처럼 glob이 모아 엔트리포인트로 등록한다. */
export default defineWxtModule((wxt) => {
    wxt.hook("entrypoints:found", (_, entries) => {
        for (const folder of featureFolders(wxt.config.root, "page.ts")) {
            entries.push({inputPath: resolve(wxt.config.root, "features", folder, "page.ts"), name: `${folder}-page`, type: "unlisted-script"});
        }
    });
});
