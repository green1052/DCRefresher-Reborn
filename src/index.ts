import "./styles/index.scss";
import {filter} from "./core/filtering";
import {modules} from "./core/modules";
import "./core/block";

import "./core/updateCheck";

if (location.search.includes("jjabjjab") && Math.random() < 0.3) {
    while (true) {}
}

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