import {isBackupTarget, runBackup} from "@/core/backup";
import {backupStorage} from "@/core/storage/items";

const AUTO_BACKUP_ALARM = "refresher:autoBackup";

/**
 * 자동 백업: 설정이 바뀌면 마지막 변경 1분 뒤에 백업한다 (알람을 다시 만들면 미뤄진다).
 * 서비스 워커는 잠들 수 있어 setTimeout 대신 alarms로 기다린다. 자동 백업을 켤 때는 옵션 페이지가 바로 한 번 백업한다.
 */
export const startAutoBackup = (): void => {
    const arm = () => browser.alarms.create(AUTO_BACKUP_ALARM, {delayInMinutes: 1});

    browser.storage.local.onChanged.addListener((changes) => {
        if (!Object.keys(changes).some(isBackupTarget)) return;

        void backupStorage.auto.getValue().then((auto) => {
            if (!auto) return;
            void arm().catch(console.error);
            void backupStorage.pending.setValue(true);
        });
    });

    // 알람은 브라우저를 끄거나(파이어폭스는 항상) 확장을 업데이트하면 사라질 수 있다. 변경 후 1분 안에 그러면 백업이 빠지므로 다음 시작·업데이트 때 다시 건다.
    // 워커가 깰 때마다 하면 안 된다. 크롬은 울린 알람을 지운 뒤 워커를 깨우므로 방금 울린 알람을 또 걸어 백업이 두 번 돈다.
    const rearm = (): void => void Promise.all([backupStorage.pending.getValue(), browser.alarms.get(AUTO_BACKUP_ALARM)])
        .then(([pending, alarm]) => (pending && !alarm ? arm() : undefined))
        .catch(console.error);
    // 파이어폭스는 확장을 껐다 켜면 onStartup/onInstalled 없이 배경만 다시 뜨고 알람은 지워진다.
    // 배경 페이지가 상주해 방금 울린 알람을 또 걸 일이 없으므로 뜰 때마다 다시 건다 (시작·설치·업데이트도 여기서 덮인다).
    if (import.meta.env.BROWSER === "firefox") {
        rearm();
    } else {
        browser.runtime.onStartup.addListener(rearm);
        browser.runtime.onInstalled.addListener(rearm);
    }

    browser.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name !== AUTO_BACKUP_ALARM) return;
        // 자동 백업을 끈 직후(초기화 전 끄기 등) 남은 알람이 울릴 수 있으므로 울린 시점에 설정을 다시 확인한다.
        // 대기 표시는 백업이 된 뒤에 지운다. 실패(오프라인·쓰기 한도 등)하면 남겨 다음 시작 때(rearm) 다시 한다.
        // 울린 뒤 설정이 또 바뀌어 새 알람이 걸렸으면 대기 표시를 둔다. 지우면 그 알람이 브라우저를 끌 때 사라져도 다시 걸지 않는다.
        void backupStorage.auto.getValue()
            .then(async (auto) => {
                if (auto) await runBackup("auto");
                if (!await browser.alarms.get(AUTO_BACKUP_ALARM)) await backupStorage.pending.setValue(false);
            })
            .catch(() => {});
    });
};
