import "../styles/index.scss";
import "../core/memo";
import "../core/block";
import "../core/updateCheck";

import type {PlasmoCSConfig} from "plasmo";

import filter from "../core/filtering";
import modules from "../core/modules";
// @ts-ignore
import * as modulesList from "../modules/*.ts";

// @ts-ignore
Promise.all(Object.values(modulesList).map((module) => modules.load(module.default))).then(filter.run);

export const config: PlasmoCSConfig = {
    matches: ["https://*.dcinside.com/*"],
    exclude_matches: [
        "https://event.dcinside.com/*",
        "https://h5.dcinside.com/*",
        "https://mall.dcinside.com/*",
        "https://wiki.dcinside.com/*"
    ],
    run_at: "document_start"
};
