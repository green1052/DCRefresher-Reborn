import {isBackupTarget, runBackup} from "@/core/backup";
import {updateDatabase} from "@/core/database";
import {migrateV5Storage} from "@/core/migrate-v5";
import {onMessage, sendMessage} from "@/core/messaging/protocol";
import {isModuleEnabled, normalizeSetting} from "@/core/module/settings";
import {backupStorage, dbStorage, moduleSettingsStorage, modulesStorage} from "@/core/storage/items";
import imageSearch, {IMAGE_SEARCH_ENGINES, IMAGE_URL_PATTERNS, imageSearchUrl} from "@/features/imagesearch";

const DATABASE_UPDATE_INTERVAL = 604_800_000; // 7일
/** 7일이 지났는지 1시간마다 본다 — 받기에 실패해도 다음 알람이 다시 받는다 */
const DATABASE_ALARM = "refresher:dbCheck";
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

/**
 * 탭의 페이지 컨텍스트에서 실행된다 (직렬화되므로 바깥 변수를 쓰지 않는다).
 * 디시는 자체 차단(block-disable)과 이용자 메모 배지를 목록을 그릴 때 한 번만 건다 — 없는 페이지면 건너뛴다
 */
const rerunListScripts = (gallery: string): void => {
    const scope = window as Window & {
        chk_user_block?: (id: string) => void;
        UserMemo?: { renderWriterMemoBadges?: (wrapper: null) => void };
    };

    // 디시가 이 페이지를 열 때 넘긴 값 그대로 — 미니 갤러리는 목록('id')과 글 페이지('mi$id')가 달라 id로 짐작하면 다른 설정을 읽는다
    const loaded = [...document.scripts].map((script) => /chk_user_block\('([^']*)'\)/.exec(script.textContent ?? "")?.[1]).find((id) => id !== undefined);
    if (typeof scope.chk_user_block === "function") scope.chk_user_block(loaded ?? gallery);
    // null이면 디시가 처음 그릴 때 등록한 범위(목록·글 머리)를 다시 그린다
    if (typeof scope.UserMemo?.renderWriterMemoBadges === "function") scope.UserMemo.renderWriterMemoBadges(null);
};

const IMAGE_MENU_PREFIX = "imagesearch:";

/** 이미지 검색 메뉴 — 켠 엔진마다 하나 (둘 이상이면 브라우저가 확장 이름 아래로 묶는다). 모듈이 꺼져 있으면 없다 */
const buildContextMenus = async (): Promise<void> => {
    await browser.contextMenus.removeAll();

    // 콘텐츠 레지스트리와 같은 기준
    if (!isModuleEnabled(imageSearch, await modulesStorage.getValue())) return;

    const stored = await moduleSettingsStorage(imageSearch.id).getValue();
    for (const [id, {name}] of Object.entries(IMAGE_SEARCH_ENGINES)) {
        const schema = imageSearch.settings?.[id];
        if (!schema || !normalizeSetting(schema, stored[id])) continue;

        browser.contextMenus.create({id: IMAGE_MENU_PREFIX + id, title: `${name} 검색`, contexts: ["image"], targetUrlPatterns: IMAGE_URL_PATTERNS});
    }
};

export default defineBackground(() => {
    // ===== Context Menus: 이미지 검색 =====
    // 연달아 부르면 removeAll과 create가 엇갈려 id가 겹친다 — 앞의 것이 끝난 뒤 다시 만든다
    let menus = Promise.resolve();
    const createContextMenus = (): Promise<void> => (menus = menus.then(buildContextMenus).catch(console.error));

    // 옵션 페이지·팝업은 저장소에 직접 쓴다 — 켜고 끄거나 엔진을 바꾸면 바로 다시 만든다
    modulesStorage.watch((next, prev) => {
        if (next[imageSearch.id] !== prev[imageSearch.id]) void createContextMenus();
    });
    moduleSettingsStorage(imageSearch.id).watch(() => void createContextMenus());

    browser.contextMenus.onClicked.addListener(async (info, tab) => {
        const id = String(info.menuItemId);
        const url = id.startsWith(IMAGE_MENU_PREFIX) && info.srcUrl ? imageSearchUrl(id.slice(IMAGE_MENU_PREFIX.length), info.srcUrl) : null;
        if (!url) return;

        // 이미지가 있던 탭 바로 옆에, 그 탭을 opener로 연다
        await browser.tabs.create(tab?.id !== undefined && tab.id >= 0 ? {url, index: tab.index + 1, openerTabId: tab.id, windowId: tab.windowId} : {url});
    });

    browser.runtime.onStartup.addListener(() => void createContextMenus());
    // Firefox(MV2)는 메뉴를 남겨 두지 않는다 — 확장을 껐다 켜면 onStartup/onInstalled 없이 백그라운드만 다시 뜬다
    if (import.meta.env.FIREFOX) void createContextMenus();

    // ===== Commands: 단축키 → 활성 탭에만 전송 =====
    // 단축키 기능은 '이번 페이지' 단위라 모든 탭에 보내면 탭마다 토글·토스트·목록 요청이 한꺼번에 일어난다
    browser.commands.onCommand.addListener(async (command, tab) => {
        // 활성 탭이 디시가 아니면 받는 쪽이 없어 실패한다
        if (tab?.id) await sendMessage("refresher:executeShortcut", command, {tabId: tab.id}).catch(() => {});
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

    // ===== 목록 교체: 갈아끼운 행에 디시의 자체 차단·메모 표시를 그 탭의 페이지(MAIN world)에서 다시 건다 =====
    onMessage("refresher:listReplaced", async ({data: gallery, sender}) => {
        if (!sender.tab?.id) return;

        await browser.scripting.executeScript({
            target: {tabId: sender.tab.id, frameIds: [sender.frameId ?? 0]},
            world: "MAIN",
            func: rerunListScripts,
            args: [gallery]
        }).catch(() => {});
    });

    // ===== Database: 설치/주기 갱신 =====
    // 설치 직후엔 onInstalled와 첫 주기 검사(lastUpdate 0)가 겹칠 수 있다 — 진행 중인 갱신을 같이 기다려 두 번 받지 않는다
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

    // 알람은 없을 때만 만든다 — 워커가 깰 때마다 다시 만들면 주기가 처음부터 다시 세어져 울리지 않는다.
    // 예전엔 시작할 때 한 번 봤는데, 파이어폭스(MV2)는 배경이 상주해 그 한 번이 세션 전부였다 (늦게 잡힌 네트워크·7일 넘게 켜 둔 브라우저)
    if (import.meta.env.PROD) {
        void browser.alarms.get(DATABASE_ALARM).then((alarm) => {
            if (!alarm) void browser.alarms.create(DATABASE_ALARM, {delayInMinutes: 1, periodInMinutes: 60});
        });
    }

    // ===== 자동 백업: 설정이 바뀌면 마지막 변경 1분 뒤에 백업 (알람을 다시 만들면 미뤄진다) =====
    // 서비스 워커는 잠들 수 있어 setTimeout 대신 alarms로 기다린다. 켤 때는 옵션 페이지가 바로 한 번 백업한다
    browser.storage.local.onChanged.addListener((changes) => {
        if (!Object.keys(changes).some(isBackupTarget)) return;

        void backupStorage.auto.getValue().then((auto) => {
            if (!auto) return;
            void browser.alarms.create(AUTO_BACKUP_ALARM, {delayInMinutes: 1});
            void backupStorage.pending.setValue(true);
        });
    });

    // 알람은 브라우저를 끄면 사라질 수 있다 (파이어폭스는 늘) — 1분 안에 끄면 백업이 빠지니 다음 시작 때 다시 건다.
    // 워커가 깰 때마다 보면 안 된다 — 크롬은 울린 알람을 지우고 워커를 깨우므로, 방금 울린 알람을 또 걸어 백업이 두 번 돈다
    browser.runtime.onStartup.addListener(async () => {
        const [pending, alarm] = await Promise.all([backupStorage.pending.getValue(), browser.alarms.get(AUTO_BACKUP_ALARM)]);
        if (pending && !alarm) await browser.alarms.create(AUTO_BACKUP_ALARM, {delayInMinutes: 1});
    });

    browser.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === DATABASE_ALARM) {
            void dbStorage.getValue().then(({lastUpdate}) => (Date.now() - lastUpdate > DATABASE_UPDATE_INTERVAL ? update() : undefined));
        } else if (alarm.name === AUTO_BACKUP_ALARM) {
            void backupStorage.pending.setValue(false);
            // 끈 직후 남아 있던 알람이 울릴 수 있다 (초기화 전 끄기 등) — 울린 시점에 다시 본다
            void backupStorage.auto.getValue().then((auto) => (auto ? runBackup("auto") : undefined)).catch(() => {});
        }
    });
});
