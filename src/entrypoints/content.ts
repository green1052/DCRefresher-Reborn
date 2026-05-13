import "../assets/styles/index.scss";
import "../core/memo";
import "../core/block";
import "../core/updateCheck";

import filter from "../core/filtering";
import modules from "../core/modules";

import blockModule from "../modules/block";
import dataModule from "../modules/data";
import fontsModule from "../modules/fonts";
import imagesearchModule from "../modules/imagesearch";
import layoutModule from "../modules/layout";
import manageModule from "../modules/manage";
import previewModule from "../modules/preview";
import refreshModule from "../modules/refresh";
import stealthModule from "../modules/stealth";
import userinfoModule from "../modules/userinfo";
import writeModule from "../modules/write";

const allModules = [
    blockModule,
    dataModule,
    fontsModule,
    imagesearchModule,
    layoutModule,
    manageModule,
    previewModule,
    refreshModule,
    stealthModule,
    userinfoModule,
    writeModule
];

export default defineContentScript({
    matches: ["https://*.dcinside.com/*"],
    excludeMatches: [
        "https://event.dcinside.com/*",
        "https://h5.dcinside.com/*",
        "https://m.dcinside.com/*",
        "https://mall.dcinside.com/*",
        "https://wiki.dcinside.com/*"
    ],
    runAt: "document_start",
    main() {
        Promise.all(allModules.map((mod) => modules.load(mod))).then(filter.run);
    }
});
