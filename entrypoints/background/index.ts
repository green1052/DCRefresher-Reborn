import {isBackupTarget, runBackup} from "@/core/backup";
import {updateDatabase} from "@/core/database";
import {CONTEXT_MENUS, type ContextMenuAction, sendMessage} from "@/core/messaging/protocol";
import {backupStorage, dbStorage} from "@/core/storage/items";

const DATABASE_UPDATE_INTERVAL = 604_800_000; // 7일
const AUTO_BACKUP_ALARM = "refresher:autoBackup";

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

    // ===== 자동 백업: 설정이 바뀌면 마지막 변경 1분 뒤에 백업 (알람을 다시 만들면 미뤄진다) =====
    // 서비스 워커는 잠들 수 있어 setTimeout 대신 alarms로 기다린다. 켤 때는 옵션 페이지가 바로 한 번 백업한다
    browser.storage.onChanged.addListener((changes, area) => {
        if (area !== "local" || !Object.keys(changes).some(isBackupTarget)) return;

        void backupStorage.auto.getValue().then((auto) => {
            if (auto) void browser.alarms.create(AUTO_BACKUP_ALARM, {delayInMinutes: 1});
        });
    });

    browser.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === AUTO_BACKUP_ALARM) void runBackup().catch(() => {});
    });
});
