import {storage} from "wxt/utils/storage";
import pLimit from "p-limit";

import {MODULES_KEY, moduleSettingsKey} from "@/core/storage/items";
import type {SettingValue} from "@/core/storage/types";

import {isModuleEnabled, readModuleStorage, settingsOf} from "./settings";
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

    /**
     * 켜기/끄기·설정 변경·설치·브라우저 시작 때 그 시점의 상태에 맞춘다. 모듈마다 앞의 호출이 끝난 뒤에 다음을 부른다.
     * 맞출 상태가 없는(listen만 하는) 모듈은 두지 않는다.
     */
    apply?(state: { enabled: boolean; settings: Record<string, SettingValue> }): Promise<void> | void;
}

export const defineBackgroundModule = (module: BackgroundModule): BackgroundModule => module;

/** 탭에서 온 메시지의 보낸 쪽. 팝업·옵션 같은 확장 페이지는 tab이 없다. */
type TabSender = Browser.runtime.MessageSender & { tab: { id: number } };

export const hasTab = (sender: Browser.runtime.MessageSender): sender is TabSender => sender.tab?.id !== undefined;

/**
 * 메시지를 보낸 문서의 페이지(MAIN world)에서 func를 실행한다.
 * 크롬은 문서(documentId)로 집는다. 프레임 번호로 집으면 그사이 다른 페이지로 넘어갔거나 보낸 쪽이 프리렌더 중인 페이지일 때
 * 지금 보이는 다른 문서에서 돈다. 파이어폭스는 documentId를 주지 않아 프레임 번호로 집는다.
 */
export const runInPage = <Args extends unknown[], Result>(sender: TabSender, func: (...args: Args) => Result, args: Args) => {
    const {tab: {id: tabId}, frameId, documentId} = sender;
    const target = documentId ? {tabId, documentIds: [documentId]} : {tabId, frameIds: [frameId ?? 0]};
    return browser.scripting.executeScript({target, world: "MAIN", func, args});
};

/** 배경 모듈을 시작한다. 모든 모듈을 지금 상태에 다시 맞추는 함수를 돌려준다 (설치·브라우저 시작 때 배경이 부른다). */
export const startBackgroundModules = (modules: BackgroundModule[]): (() => Promise<void>) => {
    const appliers = modules.map((module) => {
        module.listen?.();
        // listen만 하는 모듈은 맞출 상태가 없다.
        const applyState = module.apply?.bind(module);
        if (!applyState) return async () => {};

        // apply가 겹치면 메뉴 지우기·만들기 같은 비동기 작업이 엇갈리므로 줄 세운다.
        const applies = pLimit(1);
        const apply = (): Promise<void> => applies(async () => {
            // on/off·설정 읽기와 해석은 콘텐츠 레지스트리와 같은 함수로 한다.
            const {enables, settings} = await readModuleStorage([module.id]);
            await applyState({
                enabled: isModuleEnabled(module, enables),
                settings: settingsOf(module, settings.get(module.id))
            });
        }).catch(console.error);

        // 옵션 페이지·팝업은 저장소에 직접 쓰므로 저장소를 감시해 바로 다시 맞춘다.
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
