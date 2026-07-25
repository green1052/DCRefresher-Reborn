import {onMessage, sendMessage} from "@/http/messaging";
import {databaseStorage} from "@/storage/wxtStorage";

export default defineBackground(() => {
    // ===== Broadcast: popup/content → background → 모든 탭 =====
    onMessage("broadcast", async ({data}) => {
        const {type, data: payload} = data;

        try {
            const tabs = await browser.tabs.query({url: ["https://*.dcinside.com/*"]});
            const promises: Promise<unknown>[] = [];

            for (const tab of tabs) {
                if (!tab.id) continue;
                promises.push(
                    browser.tabs.sendMessage(tab.id, {type, data: payload}).catch(() => {
                    })
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
    const contextMenuItems: Browser.contextMenus.CreateProperties[] = [
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

    const createContextMenus = async () => {
        await browser.contextMenus.removeAll();
        for (const item of contextMenuItems) {
            browser.contextMenus.create(item);
        }
    };

    browser.contextMenus.onClicked.addListener((info, tab) => {
        if (!tab?.id) return;
        // 타입 안전 메시징: 활성 탭에 전달
        switch (info.menuItemId) {
            case "blockSelected":
                sendMessage("blockSelected", undefined, tab.id).catch(() => {});
                break;
            case "memoSelected":
                sendMessage("memoSelected", undefined, tab.id).catch(() => {});
                break;
            case "dcconSelected":
                sendMessage("dcconSelected", undefined, tab.id).catch(() => {});
                break;
            case "dcconAllSelected":
                sendMessage("dcconAllSelected", undefined, tab.id).catch(() => {});
                break;
            case "searchSauceNao":
                sendMessage("searchSauceNao", undefined, tab.id).catch(() => {});
                break;
        }
    });

    browser.runtime.onStartup.addListener(createContextMenus);
    browser.runtime.onInstalled.addListener(createContextMenus);

    // ===== Commands: 단축키 → 모든 탭에 broadcast =====
    browser.commands.onCommand.addListener((command) => {
        sendMessage("broadcast", {type: "executeShortcut", data: command});
    });

    // ===== Database Update =====
    const CONSTANTS = {
        DATABASE_UPDATE_INTERVAL: 604800000,
        API_BASE_URL: "https://dcrefresher.green1052.com/data"
    } as const;

    const updateDatabase = async (): Promise<void> => {
        const {default: ky} = await import("ky");
        try {
            const [version, ip, ban] = await Promise.all([
                ky.get(`${CONSTANTS.API_BASE_URL}/version`).text(),
                ky.get(`${CONSTANTS.API_BASE_URL}/ip.json`).json<unknown>(),
                ky.get(`${CONSTANTS.API_BASE_URL}/ban.json`).json<unknown>()
            ]);
            await Promise.all([
                databaseStorage.ip.setValue(ip as Record<string, string>),
                databaseStorage.ban.setValue(ban as Record<string, string[]>),
                databaseStorage.version.setValue(version),
                databaseStorage.lastUpdate.setValue(Date.now())
            ]);
        } catch (error) {
            console.error("Database update failed:", error);
        }
    };

    // ===== Lifecycle =====
    browser.runtime.onInstalled.addListener(async (details) => {
        await createContextMenus();
        if (import.meta.env.PROD) {
            await updateDatabase();
        } else {
            const version = await databaseStorage.version.getValue();
            if (!version) {
                await updateDatabase();
            }
        }
    });

    if (import.meta.env.PROD) {
        (async () => {
            const lastUpdate = await databaseStorage.lastUpdate.getValue();
            if (!lastUpdate || Date.now() - lastUpdate > CONSTANTS.DATABASE_UPDATE_INTERVAL) {
                updateDatabase();
            }
        })();
    }
});
