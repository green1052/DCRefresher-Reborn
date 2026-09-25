import {defineExtensionMessaging} from "@webext-core/messaging";

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
}

export const {sendMessage, onMessage} = defineExtensionMessaging<ProtocolMap>();
