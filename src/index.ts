import "./styles/index.scss";
import {filter} from "./core/filtering";
import {modules} from "./core/modules";
import log from "./utils/logger";
import "./core/block";

import "./core/updateCheck";

log("🍊⚓ Initializing DCRefresher Reborn.");

const loadStart = performance.now();

const context = require.context("./modules/", true, /\.ts$/);

Promise.all(context.keys().map((v) => modules.load(context(v).default))).then(
    () => {
        const took = (performance.now() - loadStart).toFixed(2);
        log(`🍊✔️ DCRefresher Reborn Module Loaded. took ${took}ms.`);

        filter.run();
    }
);

window.addEventListener("load", filter.run);
