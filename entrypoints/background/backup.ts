import {isBackupTarget, runBackup} from "@/core/backup";
import {backupStorage} from "@/core/storage/items";

const AUTO_BACKUP_ALARM = "refresher:autoBackup";

// 설정이 바뀌면 1분 뒤 백업 - 워커가 잠들 수 있어 setTimeout 대신 alarms로 기다린다.
export const startAutoBackup = (): void => {
    const arm = () => browser.alarms.create(AUTO_BACKUP_ALARM, {delayInMinutes: 1});
    // 백업 대상이 바뀐 횟수. 알람이 울려 백업하는 사이 또 바뀌었는지 본다.
    let edits = 0;

    browser.storage.local.onChanged.addListener((changes) => {
        if (!Object.keys(changes).some(isBackupTarget)) return;
        edits++;

        void backupStorage.auto().getValue().then((auto) => {
            if (!auto) return;
            void arm().catch(console.error);
            void backupStorage.pending().setValue(true);
        });
    });

    // 알람은 사라질 수 있어 시작 때 다시 건다 - 깰 때마다 하면 크롬은 방금 울린 알람을 또 걸어 백업이 두 번 돈다.
    const rearm = (): void => void Promise.all([backupStorage.pending().getValue(), browser.alarms.get(AUTO_BACKUP_ALARM)])
        .then(([pending, alarm]) => (pending && !alarm ? arm() : undefined))
        .catch(console.error);
    // 파이어폭스는 배경이 다시 뜰 때 알람이 지워져 있고 상주 페이지라 이중 걸 일이 없어 뜰 때마다 다시 건다.
    if (import.meta.env.BROWSER === "firefox") {
        rearm();
    } else {
        browser.runtime.onStartup.addListener(rearm);
        browser.runtime.onInstalled.addListener(rearm);
    }

    browser.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name !== AUTO_BACKUP_ALARM) return;
        // 끈 직후 남은 알람에 대비해 설정을 다시 보고, 대기 표시는 그사이 변경이 없을 때만 지운다.
        const seen = edits;
        void backupStorage.auto().getValue()
            .then(async (auto) => {
                if (auto) await runBackup("auto");
                if (edits === seen) await backupStorage.pending().setValue(false);
            })
            .catch(() => {});
    });
};
