import "@/assets/styles/index.scss";
import "@/core/memo";
import "@/core/block";

import filter from "@/core/filtering";
import modules from "@/core/modules";
import {EXCLUDED_DCINSIDE_MATCHES} from "@/utils/excludeMatches";

const moduleLoaders = import.meta.glob<{ default: RefresherModule }>([
    "./modules/*/index.ts",
    "./modules/*.ts"
]);

export default defineContentScript({
    matches: ["https://*.dcinside.com/*"],
    excludeMatches: EXCLUDED_DCINSIDE_MATCHES,
    runAt: "document_start",
    async main() {
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