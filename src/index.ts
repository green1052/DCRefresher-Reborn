import "./styles/index.scss";
import {filter} from "./core/filtering";
import {modules} from "./core/modules";
import "./core/block";

import "./core/updateCheck";
import * as storage from "./utils/storage";

console.log("🍊⚓ Initializing DCRefresher Reborn.");

const loadStart = performance.now();

const context = require.context("./modules/", true, /\.ts$/);

Promise
    .all(context.keys().map((v) => modules.load(context(v).default)))
    .then(() => {
        const took = (performance.now() - loadStart).toFixed(2);
        console.log(`🍊✔️ DCRefresher Reborn Module Loaded. took ${took}ms.`);
        filter.run();
    });


(async () => {
    const BLOCK_NAMESPACE = "__REFRESHER_BLOCK";

    const BLOCK_TYPES_KEYS: RefresherBlockType[] = [
        "NICK",
        "ID",
        "IP",
        "TITLE",
        "TEXT",
        "COMMENT",
        "DCCON",
        "TAB",
        "IMAGE"
    ];

    BLOCK_TYPES_KEYS.forEach(async (key) => {
        const keyCache = await storage.get<RefresherBlockValue[]>(
            `${BLOCK_NAMESPACE}:${key}`
        );

        keyCache.forEach((value) => {
            value.isAdvanced ??= false;
        });

        await storage.set(
            `${BLOCK_NAMESPACE}:${key}`,
            keyCache
        );
    });
})();