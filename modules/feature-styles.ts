import {defineWxtModule} from "wxt/modules";

import {featureFolders} from "./lib/features";

/**
 * 기능 모듈의 디시 페이지 CSS(features/<id>/page.css)를 모은 .wxt/page-styles.css를 만든다. entrypoints/page.content.css가 불러온다.
 * 기능의 페이지 스타일은 그 폴더에 page.css만 두면 들어간다. CSS @import는 폴더째 불러오지 못해 목록 파일을 만든다.
 * wxt prepare(설치·dev·build)가 쓴다. dev 중에 page.css를 새로 만들었으면 dev를 다시 띄운다.
 */
export default defineWxtModule((wxt) => {
    wxt.hook("prepare:types", (_, entries) => {
        const folders = featureFolders(wxt.config.root, "page.css");

        entries.push({
            path: "page-styles.css",
            text: `/* modules/feature-styles.ts가 만든다. 고치지 않는다. */\n${folders.map((folder) => `@import "../features/${folder}/page.css";`).join("\n")}\n`
        });
    });
});
