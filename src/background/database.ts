import ky from "ky";
import browser from "webextension-polyfill";

import storage from "../utils/storage";

const CONSTANTS = {
    DATABASE_UPDATE_INTERVAL: 604_800_000, // 1 week
    API_BASE_URL: "https://dcrefresher.green1052.com/data"
} as const;

const updateDatabase = async (): Promise<void> => {
    const [version, ip, ban] = await Promise.all([
        ky.get(`${CONSTANTS.API_BASE_URL}/version`).text(),
        ky.get(`${CONSTANTS.API_BASE_URL}/ip.json`).json<unknown>(),
        ky.get(`${CONSTANTS.API_BASE_URL}/ban.json`).json<unknown>()
    ]);

    await Promise.all([
        storage.set("refresher.database.ip", ip),
        storage.set("refresher.database.ban", ban),
        storage.set("refresher.database.version", version),
        storage.set("refresher.database.lastUpdate", Date.now())
    ]);
};

if (process.env.NODE_ENV === "production") {
    browser.runtime.onInstalled.addListener(updateDatabase);

    const lastUpdate = await storage.get<number>("refresher.database.lastUpdate");

    if (!lastUpdate || Date.now() - lastUpdate > CONSTANTS.DATABASE_UPDATE_INTERVAL) {
        updateDatabase();
    }
}
