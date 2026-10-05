import {updateDatabase} from "@/core/database";
import {IP_FORMAT} from "@/core/ipdb";
import {dbStorage} from "@/core/storage/items";

const DATABASE_UPDATE_INTERVAL = 604_800_000; // 7일
/**
 * 7일이 지났는지 하루마다 확인한다(meta만 읽는다). 7일마다 받으므로 더 자주 보면 서비스 워커만 괜히 깨운다.
 * 받기에 실패하면 다음 날 다시 받는다. 저장 형식이 옛것이면(확장 업데이트 때 받기 실패) 7일을 기다리지 않고 다시 받는다.
 */
const DATABASE_ALARM = "refresher:dbCheck";
const DATABASE_ALARM_PERIOD = 24 * 60;

/**
 * IP·밴 DB 주기 갱신을 건다. 지금 받는 함수를 돌려준다 (설치·업데이트 때 배경이 부른다).
 * 설치 직후에는 onInstalled와 첫 주기 검사(lastUpdate 0)가 겹칠 수 있다. 진행 중인 갱신을 같이 기다려 두 번 받지 않는다.
 */
export const startDatabaseUpdates = (): (() => Promise<void>) => {
    let updating: Promise<void> | null = null;
    const update = (): Promise<void> => (updating ??= updateDatabase().catch(console.error).finally(() => (updating = null)));

    // 시작할 때 한 번만 확인하면 배경이 상주하는 파이어폭스(MV2)는 세션 내내 다시 보지 않으므로 알람으로 확인한다.
    // 알람은 없거나 주기가 다를 때만 만든다. 워커가 깰 때마다 다시 만들면 주기가 처음부터 다시 세어져 울리지 않는다.
    if (import.meta.env.PROD) {
        void browser.alarms.get(DATABASE_ALARM).then((alarm) => {
            // 이전 빌드가 1시간 주기로 만든 알람도 여기서 바뀐다.
            if (alarm?.periodInMinutes !== DATABASE_ALARM_PERIOD) void browser.alarms.create(DATABASE_ALARM, {delayInMinutes: 1, periodInMinutes: DATABASE_ALARM_PERIOD});
        });
    }

    browser.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name !== DATABASE_ALARM) return;
        void dbStorage.meta.getValue().then(({lastUpdate, format}) =>
            (format !== IP_FORMAT || Date.now() - lastUpdate > DATABASE_UPDATE_INTERVAL ? update() : undefined));
    });

    return update;
};
