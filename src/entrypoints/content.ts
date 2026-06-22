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
import {migrateLocalStorageData} from "../utils/storageMigration";

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
    async main() {
        await migrateLocalStorageData();

        const results = await Promise.allSettled(allModules.map((module) => modules.load(module)));

        results.forEach((result, index) => {
            if (result.status === "rejected") {
                console.error(`Failed to load module: ${allModules[index].name}`, result.reason);
            }
        });

        await filter.run();
    }
});