import {updateDatabase} from "@/core/database";
import {IP_FORMAT} from "@/core/ipdb";
import {dbMetaStorage} from "@/core/storage/items";

const DATABASE_UPDATE_INTERVAL = 604_800_000; // 7일
// 하루에 한 번 meta만 확인해 워커를 덜 깨운다.
const DATABASE_ALARM = "refresher:dbCheck";
const DATABASE_ALARM_PERIOD = 24 * 60;

// 주기 갱신을 걸고 지금 받는 함수를 돌려준다 - 진행 중이면 같이 기다리고 force는 새로 받아 실패를 던진다.
export const startDatabaseUpdates = (): ((force?: boolean) => Promise<void>) => {
    let updating: Promise<void> | null = null;
    const update = (force = false): Promise<void> => {
        let current = updating;
        if (!current || force) {
            const next = Promise.allSettled([current]).then(() => updateDatabase(force));
            updating = current = next;
            void Promise.allSettled([next]).then(() => {
                if (updating === next) updating = null;
            });
        }
        return force ? current : current.catch(console.error);
    };

    // 워커가 멈출 수 있어 알람으로 확인한다 - 없을 때만 만들어 주기가 다시 세어지지 않게 한다.
    if (import.meta.env.PROD) {
        void browser.alarms.get(DATABASE_ALARM).then((alarm) => {
            if (alarm?.periodInMinutes !== DATABASE_ALARM_PERIOD) void browser.alarms.create(DATABASE_ALARM, {delayInMinutes: 1, periodInMinutes: DATABASE_ALARM_PERIOD});
        });
    }

    browser.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name !== DATABASE_ALARM) return;
        // 시계가 앞서 있을 때 저장된 lastUpdate는 미래라 차이가 음수로 남는다. 그때도 받아 지금 시계로 다시 적는다.
        void dbMetaStorage().getValue().then(({lastUpdate, format}) =>
            (format !== IP_FORMAT || lastUpdate > Date.now() || Date.now() - lastUpdate > DATABASE_UPDATE_INTERVAL ? update() : undefined));
    });

    return update;
};
