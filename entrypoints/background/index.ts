import {updateDatabase} from "@/core/database";
import {CONTEXT_MENUS, type ContextMenuAction, sendMessage} from "@/core/messaging/protocol";
import {dbStorage} from "@/core/storage/items";

const DATABASE_UPDATE_INTERVAL = 604_800_000; // 7일

export default defineBackground(() => {
    // ===== Context Menus (SauceNao) =====
    const createContextMenus = async () => {
        await browser.contextMenus.removeAll();
        for (const {id, title, contexts} of CONTEXT_MENUS) {
            browser.contextMenus.create({id, title, contexts, documentUrlPatterns: ["*://gall.dcinside.com/*"]});
        }
    };

    browser.contextMenus.onClicked.addListener(async (info, tab) => {
        if (!tab?.id) return;
        if (CONTEXT_MENUS.some((menu) => menu.id === info.menuItemId)) {
            await sendMessage("refresher:contextMenu", info.menuItemId as ContextMenuAction, {tabId: tab.id}).catch(() => {});
        }
    });

    browser.runtime.onStartup.addListener(() => void createContextMenus());

    // ===== Commands: 단축키 → 디시인사이드 탭 전체에 전송 =====
    browser.commands.onCommand.addListener(async (command) => {
        const tabs = await browser.tabs.query({url: ["https://*.dcinside.com/*"]});

        await Promise.all(
            tabs
                .filter((tab) => tab.id)
                .map((tab) => sendMessage("refresher:executeShortcut", command, {tabId: tab.id!}).catch(() => {}))
        );
    });

    // ===== Database: 설치/주기 갱신 =====
    browser.runtime.onInstalled.addListener(async () => {
        await createContextMenus();

        if (import.meta.env.PROD || !(await dbStorage.getValue()).version) {
            await updateDatabase();
        }
    });

    if (import.meta.env.PROD) {
        void (async () => {
            const {lastUpdate} = await dbStorage.getValue();
            if (!lastUpdate || Date.now() - lastUpdate > DATABASE_UPDATE_INTERVAL) {
                await updateDatabase();
            }
        })();
    }
});
