import browser from "webextension-polyfill";

let modules = {};
let settings = {};
let blocks = {};
let blockModes = {};
let memos = {};

const set = (key: string, value: unknown) => {
    (browser.storage.sync || browser.storage.local).set({[key]: value});
};

// const get = (key: string) => {
//     return new Promise<unknown>((resolve, reject) =>
//         (browser.storage.sync || browser.storage.local)
//             .get(key)
//             .then(v => {
//                 resolve(v[key]);
//             })
//     );
// };

const messageHandler = async (port: browser.Runtime.Port | null, msg: any) => {
    if (typeof msg !== "object") {
        return;
    }

    if (msg.updateUserSetting) {
        await set(`${msg.name}.${msg.key}`, msg.value);
    }

    if (msg.updateBlocks) {
        Object.keys(msg.blocks_store).forEach((key) =>
            set(`__REFRESHER_BLOCK:${key}`, msg.blocks_store[key])
        );
        blocks = msg.blocks_store;

        Object.keys(msg.blockModes_store).forEach((key) =>
            set(`__REFRESHER_BLOCK:${key}:$MODE`, msg.blockModes_store[key])
        );
        blockModes = msg.blockModes_store;
    }

    if (msg.updateMemos) {
        memos = msg.memos_store;
    }

    if (msg.module_store) {
        modules = msg.module_store;
    }

    if (msg.settings_store) {
        settings = msg.settings_store;
    }

    if (msg.blocks_store) {
        blocks = msg.blocks_store;
    }

    if (msg.memos_store) {
        memos = msg.memos_store;
    }

    if (msg.blockModes_store && Object.keys(msg.blockModes_store).length) {
        blockModes = msg.blockModes_store;
    }

    if (msg.requestRefresherModules) {
        port?.postMessage({responseRefresherModules: true, modules});
    }

    if (msg.requestRefresherSettings) {
        port?.postMessage({responseRefresherSettings: true, settings});
    }

    if (msg.requestRefresherBlocks) {
        port?.postMessage({responseRefresherBlocks: true, blocks, blockModes});
    }

    if (msg.requestRefresherMemos) {
        port?.postMessage({requestRefresherMemos: true, memos});
    }
};

browser.runtime.onConnect.addListener(p => {
    p.onMessage.addListener(msg => messageHandler(p, msg));
});

browser.runtime.onMessage.addListener(msg => {
    let toSend = msg;

    if (typeof msg === "string") {
        toSend = JSON.parse(msg);
    }

    messageHandler(null, toSend);
});

browser.runtime.onInstalled.addListener(details => {
    if (details.reason === "install") {
        // TODO : After Install
    } else if (details.reason === "update") {
        // TODO : Update
    }
});

browser.contextMenus.create({
    title: "오른쪽 클릭한 유저 차단",
    contexts: ["all"],
    documentUrlPatterns: ["*://gall.dcinside.com/*"],
    onclick: (info, tab) => {
        browser.tabs.sendMessage(tab.id!, {
            type: "blockSelected"
        });
    }
});

browser.contextMenus.create({
    title: "오른쪽 클릭한 유저 메모",
    contexts: ["all"],
    documentUrlPatterns: ["*://gall.dcinside.com/*"],
    onclick: (info, tab) => {
        browser.tabs.sendMessage(tab.id!, {
            type: "memoSelected"
        });
    }
});

browser.commands.onCommand.addListener(command => {
    browser.tabs.query({currentWindow: true, active: true}).then(tabs => {
        browser.tabs.sendMessage(tabs[0].id!, {
            type: "executeShortcut",
            data: command
        });
    });
});