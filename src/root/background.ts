import ky from "ky";
import browser from "webextension-polyfill";

import { BlockCache, BlockModeCache } from "../core/block";
import { MemoCache } from "../core/memo";
import { ModuleStore } from "../core/modules";
import { SettingsStore } from "../core/settings";
import storage from "../utils/storage";

const CONSTANTS = {
    KEEP_ALIVE_INTERVAL: 20_000,
    DATABASE_UPDATE_INTERVAL: 604_800_000, // 1 week
    API_BASE_URL: "https://dcrefresher.green1052.com/data"
} as const;

const contextMenus: browser.Menus.CreateCreatePropertiesType[] = [
    {
        id: "blockSelected",
        title: "오른쪽 클릭한 유저 차단",
        contexts: ["all"],
        documentUrlPatterns: ["*://gall.dcinside.com/*"]
    },
    {
        id: "memoSelected",
        title: "오른쪽 클릭한 유저 메모",
        contexts: ["all"],
        documentUrlPatterns: ["*://gall.dcinside.com/*"]
    },
    {
        id: "dcconSelected",
        title: "오른쪽 클릭한 디시콘 차단",
        contexts: ["all"],
        documentUrlPatterns: ["*://gall.dcinside.com/*"]
    },
    {
        id: "dcconAllSelected",
        title: "오른쪽 클릭한 디시콘 전체 차단",
        contexts: ["all"],
        documentUrlPatterns: ["*://gall.dcinside.com/*"]
    },
    {
        id: "searchSauceNao",
        title: "SauceNao 검색",
        contexts: ["image"],
        documentUrlPatterns: ["*://gall.dcinside.com/*"]
    }
];

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

let modules: ModuleStore = {};
let settings: SettingsStore = {};
let blocks: BlockCache = {
    NICK: [],
    ID: [],
    IP: [],
    TITLE: [],
    TEXT: [],
    COMMENT: [],
    DCCON: [],
    TAB: [],
    IMAGE: []
};
let blockModes: BlockModeCache = {
    NICK: "SAME",
    ID: "SAME",
    IP: "SAME",
    TITLE: "CONTAIN",
    TEXT: "CONTAIN",
    COMMENT: "CONTAIN",
    DCCON: "SAME",
    TAB: "SAME",
    IMAGE: "SAME"
};
let memos: MemoCache = {
    UID: {},
    NICK: {},
    IP: {}
};

interface Message {
    updateUserSetting?: boolean;
    name?: string;
    key?: string;
    value?: unknown;

    updateBlocks?: boolean;
    blocks_store?: BlockCache;
    blockModes_store?: BlockModeCache;

    updateMemos?: boolean;
    memos_store?: MemoCache;

    module_store?: ModuleStore;
    settings_store?: SettingsStore;

    requestRefresherModules?: boolean;
    requestRefresherSettings?: boolean;
    requestRefresherBlocks?: boolean;
    requestRefresherMemos?: boolean;
}

if (browser.runtime.getManifest().manifest_version === 3) {
    const keepAlive = () => setInterval(browser.runtime.getPlatformInfo, 20e3);
    browser.runtime.onStartup.addListener(keepAlive);
    keepAlive();
}

const messageHandler = async (port: browser.Runtime.Port | null, message: Message): Promise<void> => {
    if (typeof message !== "object") return;

    if (message.updateUserSetting && message.name && message.key !== undefined) {
        await storage.set(`${message.name}.${message.key}`, message.value);
    }

    if (message.updateBlocks && message.blocks_store && message.blockModes_store) {
        const blockPromises = Object.entries(message.blocks_store).map(([key, value]) =>
            storage.set(`__REFRESHER_BLOCK:${key}`, value)
        );
        const blockModePromises = Object.entries(message.blockModes_store).map(([key, value]) =>
            storage.set(`__REFRESHER_BLOCK:${key}:$MODE`, value)
        );

        await Promise.all([...blockPromises, ...blockModePromises]);

        blocks = message.blocks_store;
        blockModes = message.blockModes_store;
    }

    if (message.updateMemos && message.memos_store) {
        const memoPromises = Object.entries(message.memos_store).map(([key, value]) =>
            storage.set(`__REFRESHER_MEMO:${key}`, value)
        );

        await Promise.all(memoPromises);
        memos = message.memos_store;
    }

    if (message.module_store) {
        modules = message.module_store;
    }

    if (message.settings_store) {
        settings = message.settings_store;
    }

    if (message.blocks_store) {
        blocks = message.blocks_store;
    }

    if (message.memos_store) {
        memos = message.memos_store;
    }

    if (message.blockModes_store && Object.keys(message.blockModes_store).length > 0) {
        blockModes = message.blockModes_store;
    }

    if (message.requestRefresherModules) {
        port?.postMessage({ responseRefresherModules: true, modules });
    }

    if (message.requestRefresherSettings) {
        port?.postMessage({ responseRefresherSettings: true, settings });
    }

    if (message.requestRefresherBlocks) {
        port?.postMessage({
            responseRefresherBlocks: true,
            blocks,
            blockModes
        });
    }

    if (message.requestRefresherMemos) {
        port?.postMessage({ requestRefresherMemos: true, memos });
    }
};

const parseMessage = (message: unknown): Message => {
    return typeof message === "string" ? JSON.parse(message) : (message as Message);
};

browser.runtime.onConnect.addListener((port) => {
    port.onMessage.addListener((rawMessage) => messageHandler(port, parseMessage(rawMessage)));
});

browser.runtime.onMessage.addListener((rawMessage) => messageHandler(null, parseMessage(rawMessage)));

const createContextMenus = async (): Promise<void> => {
    await browser.contextMenus.removeAll();

    for (const contextMenu of contextMenus) {
        browser.contextMenus.create(contextMenu);
    }
};

browser.runtime.onStartup.addListener(createContextMenus);

browser.runtime.onInstalled.addListener(async (details) => {
    await createContextMenus();

    if (browser.runtime.getManifest().version_name) return;

    try {
        updateDatabase();
    } catch {
        // empty
    }

    storage.set(details.reason === "install" ? "refresher.firstInstall" : "refresher.updated", true);
});

browser.contextMenus.onClicked.addListener((info, tab) => {
    browser.tabs.sendMessage(tab!.id!, {
        type: info.menuItemId
    });
});

browser.commands.onCommand.addListener(async (command) => {
    const tabs = await browser.tabs.query({ currentWindow: true, active: true });

    await browser.tabs.sendMessage(tabs[0].id!, {
        type: "executeShortcut",
        data: command
    });
});

const lastUpdate = await storage.get<number>("refresher.database.lastUpdate");

if (!lastUpdate || Date.now() - lastUpdate > CONSTANTS.DATABASE_UPDATE_INTERVAL) {
    await updateDatabase();
}
