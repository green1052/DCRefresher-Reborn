/**
 * v6 안에서 바뀐 설정 옮기기. v5 마이그레이션(migrate-v5.ts)과 달리 배경·옵션(DataTab)·stores/modules가 계속 쓴다.
 * 옵션·팝업은 스키마에 없는 설정을 지우므로(pruneStaleSettings) 그보다 먼저 옮겨야 한다. 그래서 세 곳이 모두 부른다:
 * 업데이트 때 배경(migrateSettingsStorage), 옵션·팝업이 정리하기 전(stores/modules), 복원·가져오기(DataTab)
 */
import {moduleSettingsStorage} from "@/core/storage/items";

type Settings = Record<string, unknown>;

/** 6.0.x의 'IP 정보 표시' 체크(showIpInfo)를 끈 사용자는 ipInfoFilter '표시 안 함'으로 옮긴다. 새 설정이 저장돼 있으면 건드리지 않는다 */
const withIpInfoFilter = <T extends Settings>(settings: T): T =>
    settings.showIpInfo === false && settings.ipInfoFilter === undefined ? {...settings, ipInfoFilter: "none"} : settings;

/** 모듈 id → 그 모듈 설정의 변환 */
const TRANSFORMS: Record<string, <T extends Settings>(settings: T) => T> = {userinfo: withIpInfoFilter};

export const MIGRATED_MODULES = Object.keys(TRANSFORMS);

/** 모듈 설정 하나를 옮긴다. 바꿀 것이 없으면 같은 객체를 돌려준다 */
export const migrateModuleSettings = <T extends Settings>(id: string, settings: T): T => TRANSFORMS[id]?.(settings) ?? settings;

/** 저장된 모듈 설정을 옮긴다. 업데이트 때 배경이 부른다 */
export const migrateSettingsStorage = async (): Promise<void> => {
    for (const id of MIGRATED_MODULES) {
        const item = moduleSettingsStorage(id);
        const stored = await item.getValue();
        const next = migrateModuleSettings(id, stored);
        if (next !== stored) await item.setValue(next);
    }
};
