import {onMessage, sendMessage} from "@/http/messaging";
import {databaseStorage} from "@/storage/wxtStorage";

export default defineBackground(() => {
    // ponytail: broadcast 타입은 런타임에만 정해지므로 캐스팅.
    // 원시 tabs.sendMessage는 @webext-core/messaging 봉투(timestamp 등)가 없어 수신측에서 무시됨.
    const sendToTab = sendMessage as (
        type: string,
        data: unknown,
        tabId: number
    ) => Promise<unknown>;

    // ===== Broadcast: popup/content → background → 모든 탭 =====
    const broadcastToTabs = async (type: string, payload?: unknown): Promise<number> => {
        const tabs = await browser.tabs.query({url: ["https://*.dcinside.com/*"]});
        const promises: Promise<unknown>[] = [];

        for (const tab of tabs) {
            if (!tab.id) continue;
            promises.push(
                sendToTab(type, payload, tab.id).catch(() => {
                })
            );
        }

        await Promise.all(promises);
        return promises.length;
    };

    onMessage("broadcast", async ({data}) => {
        const {type, data: payload} = data;

        try {
            const sentTo = await broadcastToTabs(type, payload);
            return {success: true, sentTo};
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

        // 메뉴 id == 메시지 타입. 클릭한 탭에만 전달한다.
        if (contextMenuItems.some((item) => item.id === info.menuItemId)) {
            sendToTab(String(info.menuItemId), undefined, tab.id).catch(() => {});
        }
    });

    browser.runtime.onStartup.addListener(createContextMenus);

    // ===== Commands: 단축키 → 모든 탭에 broadcast =====
    // runtime.sendMessage는 보낸 컨텍스트(background 자신)에는 전달되지 않으므로 직접 호출
    browser.commands.onCommand.addListener((command) => {
        void broadcastToTabs("executeShortcut", command);
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
