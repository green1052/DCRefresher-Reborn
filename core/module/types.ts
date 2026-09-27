import type {LucideIcon} from "lucide-react";

import type {SettingValue} from "@/core/storage/types";

/** 설정 묶음 — 같은 객체를 group으로 가진 설정을 옵션 화면에서 첫 설정 자리의 한 칸에 모아 보여준다 (값은 설정마다 따로) */
export interface SettingGroup {
    name: string;
    desc: string;
}

export type SettingSchema = { name: string; desc: string; group?: SettingGroup } & (
    | { type: "check"; default: boolean }
    | { type: "text"; default: string; placeholder?: string }
    | { type: "range"; default: number; min: number; max: number; step: number; unit: string }
    | { type: "option"; default: string; items: Record<string, string> }
    /** default는 readonly — defineModule이 설정을 그대로(const) 추론해도 들어가게 */
    | { type: "order"; default: readonly string[]; items: Record<string, string> }
    | { type: "color"; default: string }
    /** 키 하나 (소문자 영문·숫자) */
    | { type: "key"; default: string }
);

/** 모듈의 설정 스키마 (설정 키 → 스키마) */
export type SettingsSchema = Record<string, SettingSchema>;

/** 스키마 하나의 값 타입 — option·order는 고를 수 있는 항목 키로 좁힌다 */
type SettingValueOf<T extends SettingSchema> =
    T extends { type: "check" } ? boolean
        : T extends { type: "range" } ? number
            : T extends { type: "option"; items: infer I } ? keyof I & string
                : T extends { type: "order"; items: infer I } ? (keyof I & string)[]
                    : string;

/** 스키마에서 나오는 설정값 (ctx.settings) — 스키마를 그대로 적은 모듈은 키마다 정확한 타입이 된다 */
export type SettingValues<S extends SettingsSchema> = { readonly [K in keyof S]: SettingValueOf<S[K]> };

export interface ModuleContext<S extends SettingsSchema = SettingsSchema> {
    /** 현재 모듈의 설정값 (live, 읽기 전용) */
    settings: SettingValues<S>;
    /** 이 실행의 수명 — 모듈이 멈추면 abort. DOM 리스너·eventBus.on에 {signal}로 넘긴다 */
    signal: AbortSignal;

    /** 요소 필터 등록 — 지금 있는 요소 + 이후 추가되는 요소마다 실행. 해제 함수 반환 (disable시 자동 해제) */
    addFilter(scope: string, callback: (element: HTMLElement) => void): () => void;

    /** signal을 못 받는 것(storage watch, zustand subscribe, 타이머 등)의 해제 함수. disable시 자동 해제 */
    addCleanup(dispose: () => void): void;
}

/**
 * 팝업의 '현재 페이지'에 나오는 이 페이지 한정 토글. api는 setup()의 리턴값 — 모듈이 이 페이지에서 돌 때만 보인다.
 * desc는 함수면 열 때마다 계산한다 (가린 개수 등)
 */
export interface PageToggle<Api = unknown> {
    id: string;
    label: string;
    desc: string | ((api: Api) => string);
    icon: LucideIcon;
    isOn(api: Api): boolean;
    toggle(api: Api): void;
}

/**
 * 기능 모듈. S는 설정 스키마, Api는 setup()이 돌려주는 값 — 단축키·팝업 토글이 받는다.
 * 객체를 적을 때 setup을 shortcuts·pageToggles보다 앞에 둔다 (Api를 setup에서 추론한다)
 */
export interface ModuleDefinition<S extends SettingsSchema = SettingsSchema, Api = unknown> {
    /** 아스키 id (storage 키, 저장 값과 연결) */
    id: string;
    /** 표시명 (한글) */
    name: string;
    description: string;
    /** 팝업 모듈 타일 아이콘 — 배경 스크립트가 import하는 파일에 두면 React가 배경 번들에 딸려 간다 (imagesearch 참고) */
    icon?: LucideIcon;
    /** 해당 모듈이 작동할 URL. 미지정시 항상 활성 범위 */
    urls?: RegExp[];
    /** 최초 활성 여부 (기본: true) */
    defaultEnable?: boolean;
    /** 설정 스키마 (옵션 페이지에서 렌더링됨) */
    settings?: S;

    /** 활성화시 실행. 리턴값은 shortcuts·pageToggles에 api로 전달된다 */
    setup(ctx: ModuleContext<S>): Api | Promise<Api>;

    /** 단축키 (commands — 키는 wxt.config.ts의 manifest commands 이름). registry가 setup이 끝난 모듈에만 전달한다 */
    shortcuts?: Record<string, (ctx: ModuleContext<S>, api: Api) => void | Promise<void>>;

    /** 팝업 '현재 페이지' 토글 */
    pageToggles?: PageToggle<Api>[];

    /** 비활성화시 실행 (DOM 정리 등). 리스너(signal)·cleanup은 이미 풀린 뒤다 */
    revoke?(): void;

    /** 활성 중 설정이 변경됐을 때 실행 (새 값은 ctx.settings[key]) */
    onChanged?(ctx: ModuleContext<S>, key: keyof S & string): void;
}

/** 레지스트리·옵션·팝업이 모듈을 모아 다룰 때의 타입 — 모듈마다의 설정·api 타입은 defineModule에서 지운다 */
export type AnyModule = ModuleDefinition<SettingsSchema, unknown>;
