import "../styles/index.scss";
import "../core/memo";
import "../core/block";
import "../core/updateCheck";

import type { PlasmoCSConfig } from "plasmo";

import filter from "../core/filtering";
import modules from "../core/modules";
import * as modulesList from "../modules/*.ts";

Promise.all(Object.values(modulesList).map((module) => modules.load(module.default))).then(filter.run);

import storage from "../utils/storage";

storage.get().then(console.log);

export const config: PlasmoCSConfig = {
    matches: ["https://*.dcinside.com/*"],
    exclude_matches: [
        "https://event.dcinside.com/*",
        "https://h5.dcinside.com/*",
        "https://m.dcinside.com/*",
        "https://mall.dcinside.com/*",
        "https://wiki.dcinside.com/*"
    ],
    run_at: "document_start"
};
