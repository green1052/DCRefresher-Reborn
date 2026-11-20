import {defineWxtModule} from "wxt/modules";

import {featureFolders} from "./lib/features";

/** features/<id>/page.css를 모은 .wxt/page-styles.css를 만든다 (@import는 목록 파일이 필요하다). */
export default defineWxtModule((wxt) => {
    wxt.hook("prepare:types", (_, entries) => {
        const folders = featureFolders(wxt.config.root, "page.css");

        entries.push({
            path: "page-styles.css",
            text: `${folders.map((folder) => `@import "../features/${folder}/page.css";`).join("\n")}\n`
        });
    });
});
