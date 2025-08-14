import browser from "webextension-polyfill";

import storage from "../utils/storage";

const CONSTANTS = {
    KEEP_ALIVE_INTERVAL: 20_000
} as const;

if (process.env.PLASMO_MANIFEST_VERSION === "mv3") {
    const keepAlive = () => setInterval(browser.runtime.getPlatformInfo, CONSTANTS.KEEP_ALIVE_INTERVAL);
    browser.runtime.onStartup.addListener(keepAlive);
    keepAlive();
}

browser.runtime.onInstalled.addListener(async (details) => {
    if (process.env.NODE_ENV !== "production") return;

    const key = details.reason === "install" ? "refresher.firstInstall" : "refresher.updated";
    await storage.set(key, true);
});
