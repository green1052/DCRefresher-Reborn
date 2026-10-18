import {isBackupTarget, runBackup} from "@/core/backup";
import {backupStorage} from "@/core/storage/items";

const AUTO_BACKUP_ALARM = "refresher:autoBackup";

/**
 * 자동 백업: 설정이 바뀌면 마지막 변경 1분 뒤에 백업한다 (알람을 다시 만들면 미뤄진다).
 * 서비스 워커는 잠들 수 있어 setTimeout 대신 alarms로 기다린다. 자동 백업을 켤 때는 옵션 페이지가 바로 한 번 백업한다.
 */
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

    // 알람은 브라우저를 끄거나(파이어폭스는 항상) 확장을 업데이트하면 사라질 수 있어, 대기 중인 백업은 다음 시작·업데이트 때 다시 건다.
    // 워커가 깰 때마다 하면 안 된다. 크롬은 울린 알람을 지운 뒤 워커를 깨우므로 방금 울린 알람을 또 걸어 백업이 두 번 돈다.
    const rearm = (): void => void Promise.all([backupStorage.pending().getValue(), browser.alarms.get(AUTO_BACKUP_ALARM)])
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
        // 자동 백업을 끈 직후에도 남은 알람이 울릴 수 있어 설정을 다시 확인한다.
        // 대기 표시는 백업이 되고, 그사이 설정이 또 바뀌지 않았을 때만 지운다. 남겨 두면 rearm이 다음 시작 때 다시 건다.
        // 알람 유무로 판단하면 변경이 alarms.get 응답과 엇갈릴 때 알람은 걸렸는데 대기 표시가 지워진다.
        const seen = edits;
        void backupStorage.auto().getValue()
            .then(async (auto) => {
                if (auto) await runBackup("auto");
                if (edits === seen) await backupStorage.pending().setValue(false);
            })
            .catch(() => {});
    });
};
