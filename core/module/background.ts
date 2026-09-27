import {moduleSettingsStorage, modulesStorage} from "@/core/storage/items";
import type {SettingValue} from "@/core/storage/types";

import {isModuleEnabled, normalizeSettings} from "./settings";
import type {ModuleDefinition} from "./types";

/**
 * 모듈의 배경 쪽 — features/<id>/background.ts가 default로 내보내면 배경 스크립트가 모아 돌린다 (배경은 모듈 이름을 모른다).
 * 배경 번들에 들어가므로 React·아이콘을 불러오는 모듈 파일(index.ts)은 import하지 않는다 — 설정 스키마는 React 없는 파일에 두고 같이 쓴다
 */
export interface BackgroundModule extends Pick<ModuleDefinition, "id" | "defaultEnable" | "settings"> {
    /** 배경이 뜰 때마다 곧바로 — 서비스 워커를 깨울 이벤트 리스너는 여기서 동기로 건다 (모듈이 꺼져 있어도 건다) */
    listen?(): void;

    /** 켜고 끄거나 설정이 바뀌었을 때, 설치·브라우저 시작 때 — 그때의 상태에 맞춘다. 한 번에 하나씩 차례로 부른다 */
    apply(state: { enabled: boolean; settings: Record<string, SettingValue> }): Promise<void> | void;
}

export const defineBackgroundModule = (module: BackgroundModule): BackgroundModule => module;

/** 배경 모듈을 시작한다. 모두 지금 상태에 다시 맞추는 함수를 돌려준다 (설치·브라우저 시작 때 배경이 부른다) */
export const startBackgroundModules = (modules: BackgroundModule[]): (() => Promise<void>) => {
    const appliers = modules.map((module) => {
        module.listen?.();

        // 연달아 부르면 앞의 것과 엇갈린다 (메뉴 지우기·만들기 등) — 앞의 것이 끝난 뒤 다시 맞춘다
        let queue = Promise.resolve();
        const apply = (): Promise<void> => (queue = queue.then(async () => {
            const [enables, stored] = await Promise.all([modulesStorage.getValue(), moduleSettingsStorage(module.id).getValue()]);
            // 콘텐츠 레지스트리와 같은 기준
            await module.apply({enabled: isModuleEnabled(module, enables), settings: normalizeSettings(module, stored)});
        }).catch(console.error));

        // 옵션 페이지·팝업은 저장소에 직접 쓴다 — 켜고 끄거나 설정을 바꾸면 바로 다시 맞춘다
        modulesStorage.watch((next, prev) => {
            if (next[module.id] !== prev[module.id]) void apply();
        });
        if (module.settings) moduleSettingsStorage(module.id).watch(() => void apply());

        return apply;
    });

    return async () => {
        await Promise.all(appliers.map((apply) => apply()));
    };
};
