import browser from "webextension-polyfill";

import {onMessage, sendMessage} from "../utils/messaging";
import storage from "../utils/webStorage";

import type {BlockCache, BlockModeCache} from "../core/block";
import type {MemoCache} from "../core/memo";
import type {ModuleStore} from "../core/modules";
import type {SettingsStore} from "../core/settings";

export default defineBackground(() => {
    // ===== Store State =====
    let modules: ModuleStore = {};
    let settings: SettingsStore = {};
    let blocks: BlockCache = {
        NICK: [], ID: [], IP: [], TITLE: [], TEXT: [],
        COMMENT: [], DCCON: [], TAB: [], IMAGE: []
    };
    let blockModes: BlockModeCache = {
        NICK: "SAME", ID: "SAME", IP: "SAME",
        TITLE: "CONTAIN", TEXT: "CONTAIN", COMMENT: "CONTAIN",
        DCCON: "SAME", TAB: "SAME", IMAGE: "SAME"
    };
    let memos: MemoCache = {UID: {}, NICK: {}, IP: {}};

    // ===== Message Handler: store =====
    onMessage("store", async ({data}) => {
        const {action, type, data: payload} = data;

        if (action === "update") {
            switch (type) {
                case "modules":
                    if (payload.module_store) modules = payload.module_store;
                    if (payload.settings_store) settings = payload.settings_store;
                    break;
                case "blocks":
                    if (payload.updateBlocks && payload.blocks_store && payload.blockModes_store) {
                        const blockPromises = Object.entries(payload.blocks_store).map(([key, value]) =>
                            storage.set(`__REFRESHER_BLOCK:${key}`, value)
                        );
                        const blockModePromises = Object.entries(payload.blockModes_store).map(([key, value]) =>
                            storage.set(`__REFRESHER_BLOCK:${key}:$MODE`, value)
                        );
                        await Promise.all([...blockPromises, ...blockModePromises]);
                        blocks = payload.blocks_store;
                        blockModes = payload.blockModes_store;
                    }
                    break;
                case "memos":
                    if (payload.updateMemos && payload.memos_store) {
                        const memoPromises = Object.entries(payload.memos_store).map(([key, value]) =>
                            storage.set(`__REFRESHER_MEMO:${key}`, value)
                        );
                        await Promise.all(memoPromises);
                        memos = payload.memos_store;
                    }
                    break;
                case "userSetting":
                    if (payload.name && payload.key !== undefined) {
                        await storage.set(`${payload.name}.${payload.key}`, payload.value);
                        if (settings[payload.name] && settings[payload.name][payload.key] !== undefined) {
                            settings[payload.name][payload.key].value = payload.value;
                        }
                    }
                    break;
            }
            return {success: true};
        } else if (action === "get") {
            switch (type) {
                case "modules":
                    return {modules, settings};
                case "settings":
                    return {settings};
                case "blocks":
                    return {blocks, blockModes};
                case "memos":
                    return {memos};
            }
        }
    });

    // ===== Message Handler: broadcast =====
    onMessage("broadcast", async ({data}) => {
        const {type, data: payload} = data;

        try {
            const tabs = await browser.tabs.query({});
            const promises: Promise<any>[] = [];

            for (const tab of tabs) {
                if (!tab.id) continue;
                promises.push(
                    browser.tabs.sendMessage(tab.id, {type, data: payload}).catch(() => {})
                );
            }

            await Promise.all(promises);
            return {success: true, sentTo: promises.length};
        } catch (e) {
            console.error("Broadcast error:", e);
            return {success: false, error: e};
        }
    });

    // ===== Context Menus =====
    const contextMenuItems: browser.Menus.CreateCreatePropertiesType[] = [
        {id: "blockSelected", title: "오른쪽 클릭한 유저 차단", contexts: ["all"], documentUrlPatterns: ["*://gall.dcinside.com/*"]},
        {id: "memoSelected", title: "오른쪽 클릭한 유저 메모", contexts: ["all"], documentUrlPatterns: ["*://gall.dcinside.com/*"]},
        {id: "dcconSelected", title: "오른쪽 클릭한 디시콘 차단", contexts: ["all"], documentUrlPatterns: ["*://gall.dcinside.com/*"]},
        {id: "dcconAllSelected", title: "오른쪽 클릭한 디시콘 전체 차단", contexts: ["all"], documentUrlPatterns: ["*://gall.dcinside.com/*"]},
        {id: "searchSauceNao", title: "SauceNao 검색", contexts: ["image"], documentUrlPatterns: ["*://gall.dcinside.com/*"]}
    ];

    const createContextMenus = async () => {
        await browser.contextMenus.removeAll();
        for (const item of contextMenuItems) {
            browser.contextMenus.create(item);
        }
    };

    browser.contextMenus.onClicked.addListener((info, tab) => {
        if (!tab?.id) return;
        browser.tabs.sendMessage(tab.id, {type: info.menuItemId});
    });

    browser.runtime.onStartup.addListener(createContextMenus);
    browser.runtime.onInstalled.addListener(createContextMenus);

    // ===== Commands =====
    browser.commands.onCommand.addListener((command) => {
        sendMessage("broadcast", {type: "executeShortcut", data: command});
    });

    // ===== Database Update =====
    const CONSTANTS = {
        DATABASE_UPDATE_INTERVAL: 604800000,
        API_BASE_URL: "https://dcrefresher.green1052.com/data"
    } as const;

    const updateDatabase = async () => {
        const {default: ky} = await import("ky");
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

    // ===== Lifecycle =====
    browser.runtime.onInstalled.addListener(async (details) => {
        if (import.meta.env.PROD) {
            await storage.set(details.reason === "install" ? "refresher.firstInstall" : "refresher.updated", true);
            await updateDatabase();
        }
    });

    if (import.meta.env.PROD) {
        (async () => {
            const lastUpdate = await storage.get<number>("refresher.database.lastUpdate");
            if (!lastUpdate || Date.now() - lastUpdate > CONSTANTS.DATABASE_UPDATE_INTERVAL) {
                updateDatabase();
            }
        })();
    }
});
