import { sendToBackground } from "@plasmohq/messaging";
import browser from "webextension-polyfill";

const contextMenuItems: browser.Menus.CreateCreatePropertiesType[] = [
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

const createContextMenus = async (): Promise<void> => {
    await browser.contextMenus.removeAll();

    for (const contextMenu of contextMenuItems) {
        browser.contextMenus.create(contextMenu);
    }
};

browser.contextMenus.onClicked.addListener((info, tab) => {
    sendToBackground({
        name: "broadcast",
        body: {
            type: info.menuItemId as string,
            targetUrl: "dcinside.com"
        }
    });
});

browser.runtime.onStartup.addListener(createContextMenus);
browser.runtime.onInstalled.addListener(createContextMenus);
