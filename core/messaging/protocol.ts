import {defineExtensionMessaging} from "@webext-core/messaging";

import type {ModuleSchema} from "@/core/module/types";
import type {SettingValue} from "@/core/storage/types";

/** 배경 스크립트 컨텍스트 메뉴 id == 메시지 액션 */
export type ContextMenuAction = "searchSauceNao";

export const CONTEXT_MENUS: {
    id: ContextMenuAction;
    title: string;
    contexts: NonNullable<Browser.contextMenus.CreateProperties["contexts"]>;
}[] = [{id: "searchSauceNao", title: "SauceNao 검색", contexts: ["image"]}];

interface ProtocolMap {
    /** 배경 → 탭: 컨텍스트 메뉴 클릭 */
    "refresher:contextMenu"(data: ContextMenuAction): void;
    /** 배경 → 탭: 단축키 실행 (commands) */
    "refresher:executeShortcut"(data: string): void;
    /** 옵션 → 탭: 모듈 스키마 + 현재값 */
    "refresher:getModuleSchema"(): ModuleSchema[];
    /** 옵션 → 탭: 모듈 토글 */
    "refresher:toggleModule"(data: {id: string; value: boolean}): void;
    /** 옵션 → 탭: 설정 변경. 정규화된 값을 반환 */
    "refresher:setSetting"(data: {id: string; key: string; value: SettingValue}): SettingValue;
}

export const {sendMessage, onMessage} = defineExtensionMessaging<ProtocolMap>();
