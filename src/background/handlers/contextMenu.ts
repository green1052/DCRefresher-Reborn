import browser from "webextension-polyfill";

const contextMenuItems: browser.Menus.CreateCreatePropertiesType[] = [
    {
        id: "blockSelected",
        title: "오른쪽 클릭한 유저 차단",
        contexts: ["all"],
        documentUrlPatterns: ["*://gall.dcinside.com/*", "*://m.dcinside.com/*"]
    },
    {
        id: "memoSelected",
        title: "오른쪽 클릭한 유저 메모",
        contexts: ["all"],
        documentUrlPatterns: ["*://gall.dcinside.com/*", "*://m.dcinside.com/*"]
    },
    {
        id: "dcconSelected",
        title: "오른쪽 클릭한 디시콘 차단",
        contexts: ["all"],
        documentUrlPatterns: ["*://gall.dcinside.com/*", "*://m.dcinside.com/*"]
    },
    {
        id: "dcconAllSelected",
        title: "오른쪽 클릭한 디시콘 전체 차단",
        contexts: ["all"],
        documentUrlPatterns: ["*://gall.dcinside.com/*", "*://m.dcinside.com/*"]
    },
    {
        id: "searchSauceNao",
        title: "SauceNao 검색",
        contexts: ["image"],
        documentUrlPatterns: ["*://gall.dcinside.com/*", "*://m.dcinside.com/*"]
    }
];

const createContextMenus = async (): Promise<void> => {
    if (!browser.contextMenus) return;

    await browser.contextMenus.removeAll();
    for (const contextMenu of contextMenuItems) {
        browser.contextMenus.create(contextMenu);
    }
};

if (browser.contextMenus?.onClicked) {
    browser.contextMenus.onClicked.addListener((info, tab) => {
        if (!tab?.id) return;

        browser.tabs.sendMessage(tab.id, {
            type: info.menuItemId
        });
    });
}

if (browser.contextMenus) {
    browser.runtime.onStartup.addListener(createContextMenus);
    browser.runtime.onInstalled.addListener(createContextMenus);
}
