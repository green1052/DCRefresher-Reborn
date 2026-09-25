import {isBackupTarget, runBackup} from "@/core/backup";
import {updateDatabase} from "@/core/database";
import {migrateV5Storage} from "@/core/migrate-v5";
import {CONTEXT_MENUS, type ContextMenuAction, onMessage, sendMessage} from "@/core/messaging/protocol";
import {backupStorage, dbStorage} from "@/core/storage/items";

const DATABASE_UPDATE_INTERVAL = 604_800_000; // 7일
const AUTO_BACKUP_ALARM = "refresher:autoBackup";

const GRECAPTCHA_SITE_KEY = "6Lc-Fr0UAAAAAOdqLYqPy53MxlRMIXpNXFvBliwI";
/** api.js가 막혀 있으면(광고 차단 등) 끝나지 않으니 기다리지 않는다 */
const GRECAPTCHA_TIMEOUT = 15_000;

/**
 * 탭의 페이지 컨텍스트에서 실행된다 (직렬화되므로 바깥 변수를 쓰지 않는다).
 * api.js는 이때 처음 불러온다 — 미리 넣으면 원문 comment.js의 typeof grecaptcha 검사가 바뀌어 v2 체크박스가 뜬다
 */
const executeGrecaptcha = async (siteKey: string, action: string): Promise<string> => {
    type Grecaptcha = { ready: (callback: () => void) => void; execute: (key: string, options: { action: string }) => Promise<string> };
    const scope = window as Window & { grecaptcha?: Grecaptcha };

    if (!scope.grecaptcha) {
        await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("api.js"));
            document.head.append(script);
        });
    }

    const grecaptcha = scope.grecaptcha!;
    await new Promise<void>((resolve) => grecaptcha.ready(resolve));
    return grecaptcha.execute(siteKey, {action});
};

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
            await sendMessage("refresher:contextMenu", {action: info.menuItemId as ContextMenuAction, srcUrl: info.srcUrl}, {tabId: tab.id}).catch(() => {});
        }
    });

    browser.runtime.onStartup.addListener(() => void createContextMenus());

    // ===== Commands: 단축키 → 활성 탭에만 전송 =====
    // 단축키 기능은 '이번 페이지' 단위라 모든 탭에 보내면 탭마다 토글·토스트·목록 요청이 한꺼번에 일어난다
    browser.commands.onCommand.addListener(async (command, tab) => {
        // 구버전 Firefox는 tab 인자를 넘기지 않는다
        const id = tab?.id ?? (await browser.tabs.query({active: true, lastFocusedWindow: true}))[0]?.id;
        // 활성 탭이 디시가 아니면 받는 쪽이 없어 실패한다
        if (id) await sendMessage("refresher:executeShortcut", command, {tabId: id}).catch(() => {});
    });

    // ===== reCAPTCHA: 디시가 v3 토큰을 요구할 때만 그 탭의 페이지(MAIN world)에서 받아 온다 =====
    // 토큰은 디시 도메인에서 실행해야 유효하다. 상주 스크립트 없이 필요할 때 한 번만 주입한다
    onMessage("refresher:grecaptchaToken", async ({data: action, sender}) => {
        if (!sender.tab?.id) return undefined;

        try {
            const injection = browser.scripting.executeScript({
                target: {tabId: sender.tab.id, frameIds: [sender.frameId ?? 0]},
                world: "MAIN",
                func: executeGrecaptcha,
                args: [GRECAPTCHA_SITE_KEY, action]
            });
            const timeout = new Promise<undefined>((resolve) => setTimeout(resolve, GRECAPTCHA_TIMEOUT));
            const [result] = (await Promise.race([injection, timeout])) ?? [];
            return typeof result?.result === "string" ? result.result : undefined;
        } catch {
            return undefined;
        }
    });

    // ===== Database: 설치/주기 갱신 =====
    // 설치 직후엔 onInstalled와 아래 주기 검사(lastUpdate 0)가 동시에 부른다 — 진행 중인 갱신을 같이 기다려 두 번 받지 않는다
    let updating: Promise<void> | null = null;
    const update = (): Promise<void> => (updating ??= updateDatabase().catch(console.error).finally(() => (updating = null)));

    browser.runtime.onInstalled.addListener(async () => {
        // v5에서 업데이트한 경우 설정을 v6 형식으로 옮긴다 (한시적)
        // 실패해도 DB 갱신·메뉴 생성은 이어서 한다
        await migrateV5Storage().catch(console.error);
        await createContextMenus();

        if (import.meta.env.PROD || !(await dbStorage.getValue()).version) {
            await update();
        }
    });

    if (import.meta.env.PROD) {
        void (async () => {
            const {lastUpdate} = await dbStorage.getValue();
            if (!lastUpdate || Date.now() - lastUpdate > DATABASE_UPDATE_INTERVAL) {
                await update();
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
        // 끈 직후 남아 있던 알람이 울릴 수 있다 (초기화 전 끄기 등) — 울린 시점에 다시 본다
        if (alarm.name === AUTO_BACKUP_ALARM) void backupStorage.auto.getValue().then((auto) => (auto ? runBackup("auto") : undefined)).catch(() => {});
    });
});
