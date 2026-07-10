import "../assets/styles/index.scss";
import "../core/memo";
import "../core/block";
import "../core/updateCheck";

import filter from "../core/filtering";
import modules from "../core/modules";
import {migrateLocalStorageData} from "../utils/storageMigration";

const moduleLoaders = import.meta.glob<{default: RefresherModule}>("../modules/*.ts");

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

        const loadedModules = await Promise.all(
            Object.values(moduleLoaders).map((loader) => loader().then((m) => m.default))
        );

        const allModules = loadedModules.filter((m): m is RefresherModule => m !== undefined);

        const results = await Promise.allSettled(allModules.map((module) => modules.load(module)));

        results.forEach((result, index) => {
            if (result.status === "rejected") {
                console.error(`Failed to load module: ${allModules[index].name}`, result.reason);
            }
        });

        await filter.run();
    }
});