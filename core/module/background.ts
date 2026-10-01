import {storage} from "wxt/utils/storage";

import {MODULES_KEY, moduleSettingsKey} from "@/core/storage/items";
import type {SettingValue} from "@/core/storage/types";
import {isRecord} from "@/utils/record";

import {isModuleEnabled, normalizeSettings} from "./settings";
import type {ModuleDefinition} from "./types";

/**
 * 모듈의 배경 쪽. features/<id>/background.ts가 default로 내보내면 배경 스크립트가 glob으로 모아 돌린다.
 * 배경 번들에 React가 딸려 가지 않도록 모듈 파일(index.ts)은 import하지 않는다. 설정 스키마는 React 없는 파일에 두고 양쪽이 같이 쓴다.
 */
export interface BackgroundModule extends Pick<ModuleDefinition, "id" | "defaultEnable" | "settings"> {
    /**
     * 배경이 뜰 때마다 동기로 부른다. 서비스 워커를 깨우는 이벤트 리스너는 첫 실행 중에 걸어야 하므로 여기서 건다.
     * 모듈이 꺼져 있어도 부른다.
     */
    listen?(): void;

    /** 켜기/끄기·설정 변경·설치·브라우저 시작 때 그 시점의 상태에 맞춘다. 모듈마다 앞의 호출이 끝난 뒤에 다음을 부른다 */
    apply(state: { enabled: boolean; settings: Record<string, SettingValue> }): Promise<void> | void;
}

export const defineBackgroundModule = (module: BackgroundModule): BackgroundModule => module;

/** 배경 모듈을 시작한다. 모든 모듈을 지금 상태에 다시 맞추는 함수를 돌려준다 (설치·브라우저 시작 때 배경이 부른다) */
export const startBackgroundModules = (modules: BackgroundModule[]): (() => Promise<void>) => {
    const appliers = modules.map((module) => {
        module.listen?.();

        // apply가 겹치면 메뉴 지우기·만들기 같은 비동기 작업이 엇갈리므로 줄 세운다
        let queue = Promise.resolve();
        const apply = (): Promise<void> => (queue = queue.then(async () => {
            // 한 번의 storage.local.get으로 읽는다. 항목(defineItem)은 만드는 순간 한 번 더 읽으므로 키로 읽고 감시한다 (items.ts)
            const [enables, stored] = await storage.getItems([MODULES_KEY, moduleSettingsKey(module.id)]);
            // on/off·설정 해석은 콘텐츠 레지스트리와 같은 함수로 한다
            await module.apply({
                enabled: isModuleEnabled(module, isRecord(enables?.value) ? enables.value : {}),
                settings: normalizeSettings(module, isRecord(stored?.value) ? stored.value : null)
            });
        }).catch(console.error));

        // 옵션 페이지·팝업은 저장소에 직접 쓰므로 저장소를 감시해 바로 다시 맞춘다
        storage.watch<Record<string, unknown>>(MODULES_KEY, (next, prev) => {
            if (next?.[module.id] !== prev?.[module.id]) void apply();
        });
        if (module.settings) storage.watch(moduleSettingsKey(module.id), () => void apply());

        return apply;
    });

    return async () => {
        await Promise.all(appliers.map((apply) => apply()));
    };
};
