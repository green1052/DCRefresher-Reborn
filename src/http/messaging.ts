import {defineExtensionMessaging} from "@webext-core/messaging";

// ===== Content → Background =====

interface BroadcastPayload<TType extends string, TData = unknown> {
    type: TType;
    data?: TData;
}

type BroadcastResult = { success: boolean; sentTo?: number; error?: unknown };

// ===== Background → Content (탭 브로드캐스트 결과는 무시) =====

// 모든 broadcast 메시지 타입을 ProtocolMap에 명시
interface ProtocolMap {
    // Popup/Content → Background: 탭 전체 브로드캐스트 요청
    broadcast(data: BroadcastPayload<string>): BroadcastResult;

    // Popup → Content(활성 탭): 모듈 활성화 토글
    updateModuleStatus(data: { name: string; value: boolean }): void;

    // Popup → Content(활성 탭): 설정값 변경 전파
    updateSettingValue(data: { name: string; key: string; value: string | number | boolean }): void;

    // Background → Content: 단축키 실행 (broadcast로 전달됨)
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

export type {BroadcastPayload, BroadcastResult};