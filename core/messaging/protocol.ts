import {defineExtensionMessaging} from "@webext-core/messaging";

import type {ModuleSchema} from "@/core/module/types";
import type {MemoType, SettingValue} from "@/core/storage/types";

/** 배경 스크립트 컨텍스트 메뉴 id == 메시지 액션. 수정시 entrypoints/background와 동기화할 것 */
export type ContextMenuAction =
    | "blockSelected"
    | "memoSelected"
    | "dcconSelected"
    | "dcconAllSelected"
    | "searchSauceNao";

export const CONTEXT_MENUS: {
    id: ContextMenuAction;
    title: string;
    contexts: NonNullable<Browser.contextMenus.CreateProperties["contexts"]>;
}[] = [
    {id: "blockSelected", title: "오른쪽 클릭한 유저 차단", contexts: ["all"]},
    {id: "memoSelected", title: "오른쪽 클릭한 유저 메모", contexts: ["all"]},
    {id: "dcconSelected", title: "오른쪽 클릭한 디시콘 차단", contexts: ["all"]},
    {id: "dcconAllSelected", title: "오른쪽 클릭한 디시콘 전체 차단", contexts: ["all"]},
    {id: "searchSauceNao", title: "SauceNao 검색", contexts: ["image"]}
];

interface ProtocolMap {
    /** 배경 → 탭: 컨텍스트 메뉴 클릭. 선택된 유저 정보는 콘텐츠의 contextmenu 리스너가 이미 갖고 있다 */
    "refresher:contextMenu"(data: ContextMenuAction): void;
    /** 배경 → 탭: 단축키 실행 (commands) */
    "refresher:executeShortcut"(data: string): void;
    /** 팝업 → 탭: 모듈 스키마 + 현재값 */
    "refresher:getModuleSchema"(): ModuleSchema[];
    /** 팝업 → 탭: 모듈 토글 */
    "refresher:toggleModule"(data: {id: string; value: boolean}): void;
    /** 팝업 → 탭: 설정 변경. 정규화된 값을 반환 */
    "refresher:setSetting"(data: {id: string; key: string; value: SettingValue}): SettingValue;
    /** 팝업 → 탭: 메모 입력 요청 */
    "refresher:askMemo"(data: {type: MemoType; user: string}): void;
}

export const {sendMessage, onMessage} = defineExtensionMessaging<ProtocolMap>();
