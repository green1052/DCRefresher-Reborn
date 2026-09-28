/**
 * v6 안에서 바뀐 설정 옮기기. v5 마이그레이션(migrate-v5.ts)과 달리 배경·옵션(DataTab)·stores/modules가 계속 쓴다.
 */
import {moduleSettingsStorage} from "@/core/storage/items";

/**
 * 6.0.x의 'IP 정보 표시' 체크(showIpInfo)를 끈 사용자는 ipInfoFilter '표시 안 함'으로 옮긴다. 새 설정이 저장돼 있으면 건드리지 않는다.
 * 업데이트 때 배경이 부른다. 옵션·팝업은 스키마에 없는 설정을 지우므로(pruneStaleSettings) 그보다 먼저 해야 한다
 */
export const migrateShowIpInfo = async (): Promise<void> => {
    const item = moduleSettingsStorage("userinfo");
    const stored = await item.getValue();
    const next = withIpInfoFilter(stored);
    if (next !== stored) await item.setValue(next);
};

/** userinfo 설정 하나에 위 변환을 한다. 바꿀 것이 없으면 같은 객체를 돌려준다. 복원·가져오기(DataTab)도 쓴다 */
export const withIpInfoFilter = <T extends Record<string, unknown>>(settings: T): T =>
    settings.showIpInfo === false && settings.ipInfoFilter === undefined ? {...settings, ipInfoFilter: "none"} : settings;
