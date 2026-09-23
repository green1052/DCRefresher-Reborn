import {defineExtensionMessaging} from "@webext-core/messaging";

interface ProtocolMap {
    // Background → Content: 단축키 실행
    executeShortcut(data: string): void;

    // Background → Content: 컨텍스트 메뉴 - 유저 차단
    blockSelected(): void;

    // Background → Content: 컨텍스트 메뉴 - 유저 메모
    memoSelected(): void;

    // Background → Content: 컨텍스트 메뉴 - 디시콘 차단
    dcconSelected(): void;

    // Background → Content: 컨텍스트 메뉴 - 디시콘 전체 차단
    dcconAllSelected(): void;

    // Background → Content: 컨텍스트 메뉴 - SauceNao 검색
    searchSauceNao(): void;

    // Popup → Content(활성 탭): 모듈 스키마 요청
    getSchema(): ModuleSchemaMap;

    // Popup → Content(활성 탭): 메모 입력 요청
    refresherRequestMemoAsk(data: { type: RefresherMemoType; user: string }): void;
}

export const {sendMessage, onMessage} = defineExtensionMessaging<ProtocolMap>();