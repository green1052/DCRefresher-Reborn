import {storage} from "wxt/utils/storage";

import {isBackupTarget, runBackup} from "@/core/backup";
import {updateDatabase} from "@/core/database";
import {migrateV5Storage} from "@/core/migrate-v5";
import {onMessage, sendMessage} from "@/core/messaging/protocol";
import {type BackgroundModule, startBackgroundModules} from "@/core/module/background";
import {backupStorage, dbStorage} from "@/core/storage/items";

/** 모듈별 배경 코드(features/<id>/background.ts). 필요한 모듈만 이 파일을 둔다 */
const backgroundModules = Object.values(import.meta.glob<{ default: BackgroundModule }>("../../features/*/background.ts", {eager: true}))
    .map((module) => module.default);

const DATABASE_UPDATE_INTERVAL = 604_800_000; // 7일
/**
 * 7일이 지났는지 하루마다 확인한다. 서버 DB는 주 2번 바뀌고 확인할 때마다 DB 전체(수백 KB)를 읽으므로 더 자주 볼 이유가 없다.
 * 받기에 실패하면 다음 날 다시 받는다.
 */
const DATABASE_ALARM = "refresher:dbCheck";
const DATABASE_ALARM_PERIOD = 24 * 60;
const AUTO_BACKUP_ALARM = "refresher:autoBackup";

const GRECAPTCHA_SITE_KEY = "6Lc-Fr0UAAAAAOdqLYqPy53MxlRMIXpNXFvBliwI";
/** api.js가 막히면(광고 차단 등) 끝나지 않으므로 이 시간까지만 기다린다 */
const GRECAPTCHA_TIMEOUT = 15_000;

/**
 * 탭의 페이지 컨텍스트에서 실행된다(직렬화되므로 바깥 변수를 쓰지 않는다).
 * api.js는 이때 처음 불러온다. 미리 넣으면 원래 comment.js의 typeof grecaptcha 검사 결과가 바뀌어 v2 체크박스가 뜬다.
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
 * 탭의 페이지 컨텍스트에서 실행된다(직렬화되므로 바깥 변수를 쓰지 않는다).
 * 디시는 자체 차단(block-disable)과 이용자 메모 배지를 목록을 처음 그릴 때만 적용하므로 교체한 행에 다시 건다.
 * 해당 함수가 없는 페이지면 건너뛴다.
 */
const rerunListScripts = (gallery: string): void => {
    const scope = window as Window & {
        chk_user_block?: (id: string) => void;
        UserMemo?: { renderWriterMemoBadges?: (wrapper: null) => void };
    };

    // 디시가 페이지를 열 때 넘긴 값을 그대로 쓴다. 미니 갤러리는 목록('id')과 글 페이지('mi$id')의 값이 달라 id로 짐작하면 다른 설정을 읽는다
    const loaded = [...document.scripts].map((script) => /chk_user_block\('([^']*)'\)/.exec(script.textContent ?? "")?.[1]).find((id) => id !== undefined);
    if (typeof scope.chk_user_block === "function") scope.chk_user_block(loaded ?? gallery);
    // null이면 디시가 처음 그릴 때 등록한 범위(목록·글 머리)를 다시 그린다
    if (typeof scope.UserMemo?.renderWriterMemoBadges === "function") scope.UserMemo.renderWriterMemoBadges(null);
};

export default defineBackground(() => {
    // ===== 모듈의 배경 쪽 (이미지 검색 메뉴 등) =====
    // 리스너는 여기서 바로 건다. 크롬은 메뉴 같은 상태를 유지하므로 설치·브라우저 시작·설정 변경 때만 다시 맞춘다
    const applyBackgroundModules = startBackgroundModules(backgroundModules);
    browser.runtime.onStartup.addListener(() => void applyBackgroundModules());
    // Firefox(MV2)는 메뉴를 유지하지 않고, 확장을 껐다 켜면 onStartup/onInstalled 없이 배경만 다시 뜨므로 뜰 때마다 맞춘다
    if (import.meta.env.FIREFOX) void applyBackgroundModules();

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
    // 설치 직후에는 onInstalled와 첫 주기 검사(lastUpdate 0)가 겹칠 수 있다. 진행 중인 갱신을 같이 기다려 두 번 받지 않는다
    let updating: Promise<void> | null = null;
    const update = (): Promise<void> => (updating ??= updateDatabase().catch(console.error).finally(() => (updating = null)));

    browser.runtime.onInstalled.addListener(async ({reason, previousVersion}) => {
        // v5에서 업데이트한 경우만 설정을 v6 형식으로 옮긴다(한시적). 저장소 전체를 읽으므로 다른 경우는 건너뛴다.
        // 모듈 맞추기는 옮긴 설정을 보도록 그 뒤에 하고, 옮기기가 실패해도 DB 갱신까지 이어서 한다.
        if (reason === "update" && previousVersion?.startsWith("5.")) await migrateV5Storage().catch(console.error);
        // 비회원 닉네임·비밀번호는 이제 디시 localStorage에 둔다. 예전 버전이 확장 저장소에 남긴 평문 비밀번호를 지운다
        if (reason === "update") await storage.removeItem("local:refresher:nonmember").catch(console.error);
        await applyBackgroundModules();

        if (import.meta.env.PROD || !(await dbStorage.meta.getValue()).version) {
            await update();
        }
    });

    // 시작할 때 한 번만 확인하면 배경이 상주하는 파이어폭스(MV2)는 세션 내내 다시 보지 않으므로 알람으로 확인한다.
    // 알람은 없거나 주기가 다를 때만 만든다. 워커가 깰 때마다 다시 만들면 주기가 처음부터 다시 세어져 울리지 않는다.
    if (import.meta.env.PROD) {
        void browser.alarms.get(DATABASE_ALARM).then((alarm) => {
            // 이전 빌드가 1시간 주기로 만든 알람도 여기서 바뀐다
            if (alarm?.periodInMinutes !== DATABASE_ALARM_PERIOD) void browser.alarms.create(DATABASE_ALARM, {delayInMinutes: 1, periodInMinutes: DATABASE_ALARM_PERIOD});
        });
    }

    // ===== 자동 백업: 설정이 바뀌면 마지막 변경 1분 뒤에 백업한다 (알람을 다시 만들면 미뤄진다) =====
    // 서비스 워커는 잠들 수 있어 setTimeout 대신 alarms로 기다린다. 자동 백업을 켤 때는 옵션 페이지가 바로 한 번 백업한다
    browser.storage.local.onChanged.addListener((changes) => {
        if (!Object.keys(changes).some(isBackupTarget)) return;

        void backupStorage.auto.getValue().then((auto) => {
            if (!auto) return;
            void browser.alarms.create(AUTO_BACKUP_ALARM, {delayInMinutes: 1});
            void backupStorage.pending.setValue(true);
        });
    });

    // 알람은 브라우저를 끄면 사라질 수 있다(파이어폭스는 항상). 변경 후 1분 안에 끄면 백업이 빠지므로 다음 시작 때 다시 건다.
    // 워커가 깰 때마다 하면 안 된다. 크롬은 울린 알람을 지운 뒤 워커를 깨우므로 방금 울린 알람을 또 걸어 백업이 두 번 돈다.
    browser.runtime.onStartup.addListener(async () => {
        const [pending, alarm] = await Promise.all([backupStorage.pending.getValue(), browser.alarms.get(AUTO_BACKUP_ALARM)]);
        if (pending && !alarm) await browser.alarms.create(AUTO_BACKUP_ALARM, {delayInMinutes: 1});
    });

    browser.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === DATABASE_ALARM) {
            void dbStorage.meta.getValue().then(({lastUpdate}) => (Date.now() - lastUpdate > DATABASE_UPDATE_INTERVAL ? update() : undefined));
        } else if (alarm.name === AUTO_BACKUP_ALARM) {
            void backupStorage.pending.setValue(false);
            // 자동 백업을 끈 직후(초기화 전 끄기 등) 남은 알람이 울릴 수 있으므로 울린 시점에 설정을 다시 확인한다
            void backupStorage.auto.getValue().then((auto) => (auto ? runBackup("auto") : undefined)).catch(() => {});
        }
    });
});
