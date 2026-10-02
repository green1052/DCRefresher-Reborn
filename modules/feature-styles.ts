import {defineWxtModule} from "wxt/modules";

import {featureFolders} from "./lib/features";

/**
 * 기능 모듈의 디시 페이지 CSS(features/<id>/page.scss)를 모은 .wxt/page-styles.scss를 만든다. entrypoints/page.content.scss가 불러온다.
 * 기능의 페이지 스타일은 그 폴더에 page.scss만 두면 들어간다. Sass는 폴더째 불러오지 못해 목록 파일을 만든다.
 * wxt prepare(설치·dev·build)가 쓴다. dev 중에 page.scss를 새로 만들었으면 dev를 다시 띄운다.
 */
export default defineWxtModule((wxt) => {
    wxt.hook("prepare:types", (_, entries) => {
        const folders = featureFolders(wxt.config.root, "page.scss");

        entries.push({
            path: "page-styles.scss",
            // 같은 파일 이름(page)이 여럿이라 모듈 id를 이름공간으로 준다.
            text: `// modules/feature-styles.ts가 만든다. 고치지 않는다.\n${folders.map((folder) => `@use "../features/${folder}/page" as ${folder};`).join("\n")}\n`
        });
    });
});
