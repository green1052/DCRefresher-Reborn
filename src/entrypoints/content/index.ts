import "@/assets/styles/index.scss";
import "@/core/memo";
import "@/core/block";

import filter from "@/core/filtering";
import modules from "@/core/modules";

const moduleLoaders = import.meta.glob<{ default: RefresherModule }>([
    "./modules/*/index.ts",
    "./modules/*.ts"
]);

export default defineContentScript({
    matches: ["https://*.dcinside.com/*"],
    excludeMatches: [
        "https://event.dcinside.com/*",
        "https://h5.dcinside.com/*",
        "https://m.dcinside.com/*",
        "https://mall.dcinside.com/*",
        "https://wiki.dcinside.com/*",
        "https://gallog.dcinside.com/*"
    ],
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