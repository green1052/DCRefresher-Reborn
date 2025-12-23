import browser from "webextension-polyfill";
import storage from "../../utils/storage";

if (process.env.NODE_ENV === "production")
    browser.runtime.onInstalled.addListener(async (details) => {
        await storage.set(details.reason === "install" ? "refresher.firstInstall" : "refresher.updated", true);
    });