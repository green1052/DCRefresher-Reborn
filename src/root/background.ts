import browser from "webextension-polyfill";
import storage from "../utils/storage";
import {BlockCache, BlockModeCache} from "../core/block";
import {MemoCache} from "../core/memo";
import {ModuleStore} from "../core/modules";
import {SettingsStore} from "../core/settings";

let modules: ModuleStore = {};
let settings: SettingsStore = {};
let blocks: BlockCache = {};
let blockModes: BlockModeCache = {};
let memos: MemoCache = {};

// const get = (key: string) => {
//     return new Promise<unknown>((resolve, reject) =>
//         (browser.storage.sync || browser.storage.local)
//             .get(key)
//             .then(v => {
//                 resolve(v[key]);
//             })
//     );
// };

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

const messageHandler = (port: browser.Runtime.Port | null, message: Message) => {
    if (typeof message !== "object") {
        return;
    }

    if (message.updateUserSetting) {

        storage.set(`${message.name}.${message.key}`, message.value);
    }

    if (message.updateBlocks && message.blocks_store && message.blockModes_store) {
        for (const [key, value] of Object.entries(message.blocks_store)) {
            storage.set(`__REFRESHER_BLOCK:${key}`, value);
        }

        blocks = message.blocks_store;

        for (const [key, value] of Object.entries(message.blockModes_store)) {
            storage.set(`__REFRESHER_BLOCK:${key}:$MODE`, value);
        }

        blockModes = message.blockModes_store;
    }

    if (message.updateMemos && message.memos_store) {
        for (const [key, value] of Object.entries(message.memos_store)) {
            storage.set(`__REFRESHER_MEMO:${key}`, value);
        }

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

    if (message.blockModes_store && Object.keys(message.blockModes_store).length) {
        blockModes = message.blockModes_store;
    }

    if (message.requestRefresherModules) {
        port?.postMessage({responseRefresherModules: true, modules});
    }

    if (message.requestRefresherSettings) {
        port?.postMessage({responseRefresherSettings: true, settings});
    }

    if (message.requestRefresherBlocks) {
        port?.postMessage({responseRefresherBlocks: true, blocks, blockModes});
    }

    if (message.requestRefresherMemos) {
        port?.postMessage({requestRefresherMemos: true, memos});
    }
};

browser.runtime.onConnect.addListener((port) => {
    port.onMessage.addListener((message) => messageHandler(port, message));
});

browser.runtime.onMessage.addListener((message) => {
    messageHandler(null, typeof message === "string" ? JSON.parse(message) : message);
});

// browser.runtime.onInstalled.addListener(details => {
//     if (details.reason === "install") {
//         // TODO : After Install
//     } else if (details.reason === "update") {
//         // TODO : Update
//     }
// });

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
    }
]

for (const contextMenu of contextMenus) {
    browser.contextMenus.create(contextMenu);
}

browser.contextMenus.onClicked.addListener((info, tab) => {
    browser.tabs.sendMessage(tab!.id!, {
        type: info.menuItemId
    });
});

browser.commands.onCommand.addListener(command => {
    browser.tabs.query({currentWindow: true, active: true}).then(tabs => {
        browser.tabs.sendMessage(tabs[0].id!, {
            type: "executeShortcut",
            data: command
        });
    });
});