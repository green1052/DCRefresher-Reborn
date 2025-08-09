const contextMenuItems: chrome.contextMenus.CreateProperties[] = [
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
    await chrome.contextMenus.removeAll();
    for (const contextMenu of contextMenuItems) {
        chrome.contextMenus.create(contextMenu);
    }
};

chrome.contextMenus.onClicked.addListener((info, tab) => {
    chrome.tabs.sendMessage(tab!.id!, {
        type: info.menuItemId
    });
});

chrome.runtime.onStartup.addListener(createContextMenus);
chrome.runtime.onInstalled.addListener(createContextMenus);
