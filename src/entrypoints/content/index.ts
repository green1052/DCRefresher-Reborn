import "@/assets/styles/index.scss";
import "@/core/memo";
import "@/core/block";

import eventBus from "@/core/eventbus";
import filter from "@/core/filtering";
import modules from "@/core/modules";
import {migrateLocalStorageData} from "@/storage/migration";
import {databaseStorage} from "@/storage/wxtStorage";

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
        await migrateLocalStorageData();

        // 결합 분리: database IP 데이터를 eventBus로 게시 (utils/ip.ts가 구독)
        try {
            const ipData = await databaseStorage.ip.getValue();
            eventBus.emit("refresherModuleConfig", "database", {ip: ipData});
        } catch (e) {
            console.error("Failed to load database IP data:", e);
        }

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

        // 모든 모듈 로드 완료 후 설정 일괄 게시 (의존 모듈 구독 보장)
        modules.publishAllConfigs();

        await filter.run();
    }
});