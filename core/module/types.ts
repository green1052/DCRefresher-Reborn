import type {LucideIcon} from "lucide-react";

/**
 * 설정 묶음. 같은 SettingGroup 객체를 group으로 가진 설정들을 옵션 화면에서 첫 설정 자리에 한 칸으로 모아 보인다.
 * 값은 설정마다 따로 저장된다.
 */
export interface SettingGroup {
    name: string;
    desc: string;
}

export type SettingSchema = { name: string; desc: string; group?: SettingGroup } & (
    | { type: "check"; default: boolean }
    | { type: "text"; default: string; placeholder?: string }
    | { type: "range"; default: number; min: number; max: number; step: number; unit: string }
    | { type: "option"; default: string; items: Record<string, string> }
    /** default가 readonly여야 defineModule의 const 추론(readonly 튜플)을 받을 수 있다. */
    | { type: "order"; default: readonly string[]; items: Record<string, string> }
    | { type: "color"; default: string }
    /** 키 하나 (소문자 영문·숫자). */
    | { type: "key"; default: string }
);

/** 모듈의 설정 스키마 (설정 키 → 스키마). */
export type SettingsSchema = Record<string, SettingSchema>;

/** 스키마 하나의 값 타입. option·order는 고를 수 있는 항목 키로 좁힌다. */
type SettingValueOf<T extends SettingSchema> =
    T extends { type: "check" } ? boolean
        : T extends { type: "range" } ? number
            : T extends { type: "option"; items: infer I } ? keyof I & string
                : T extends { type: "order"; items: infer I } ? (keyof I & string)[]
                    : string;

/** 스키마로 만든 설정값 타입 (ctx.settings). defineModule에 스키마를 리터럴로 적으면 키마다 정확한 타입이 된다. */
type SettingValues<S extends SettingsSchema> = { readonly [K in keyof S]: SettingValueOf<S[K]> };

export interface ModuleContext<S extends SettingsSchema = SettingsSchema> {
    /** 현재 설정값 (읽기 전용). 레지스트리가 같은 객체를 갱신하므로 늘 최신이다. */
    settings: SettingValues<S>;
    /** 이 실행의 수명. 모듈이 멈추면 abort된다. DOM 리스너에 {signal}로 넘기면 따로 풀지 않아도 된다. */
    signal: AbortSignal;

    /** scope에 맞는 요소(지금 있는 것과 이후 추가되는 것)마다 callback을 부른다. 해제 함수를 돌려주며, 모듈이 멈추면 자동으로 풀린다. */
    addFilter(scope: string, callback: (element: HTMLElement) => void): () => void;

    /** signal을 받지 않는 것(storage watch, zustand subscribe, 타이머 등)의 해제 함수를 등록한다. 모듈이 멈출 때 부른다. */
    addCleanup(dispose: () => void): void;

    /**
     * 켜져 있는 동안 설정이 바뀌면 바뀐 키들로 한 번 부른다 (새 값은 ctx.settings[key]). 모듈이 멈추면 더 부르지 않는다.
     * 가져오기·초기화처럼 여러 키가 한꺼번에 바뀌어도 한 번이라 다시 그리는 일을 키마다 하지 않는다.
     * setup 안에서 등록해 setup이 만든 상태를 그대로 쓴다. await 전에 등록해야 그사이 바뀐 설정도 받는다.
     */
    onSettingsChanged(listener: (keys: ReadonlySet<keyof S & string>) => void): void;
}

/** 팝업 '현재 페이지' 토글의 표시 정보. 팝업은 메타(features/<id>/meta.ts)의 이것으로 아이콘을 찾고, 동작은 index.ts의 PageToggle이 잇는다. */
interface PageToggleMeta {
    id: string;
    label: string;
    icon: LucideIcon;
}

/**
 * 팝업 '현재 페이지'에 나오는 이 페이지 한정 토글. 모듈이 이 페이지에서 돌 때만 보이며, api는 setup()의 리턴값이다.
 * desc가 함수면 팝업을 열 때마다 계산한다 (가린 개수 등).
 */
interface PageToggle<Api = unknown> extends PageToggleMeta {
    desc: string | ((api: Api) => string);
    isOn(api: Api): boolean;
    toggle(api: Api): void;
}

/**
 * 옵션·팝업이 그리는 데 필요한 모듈 정보. features/<id>/meta.ts에 두고 index.ts가 setup 등과 합친다(defineModule({...meta, setup})).
 * 옵션·팝업은 meta.ts만 불러와, 모듈의 setup이 쓰는 HTTP 클라이언트·캐시·DOM 코드가 그 번들에 딸려 가지 않게 한다.
 */
export interface ModuleMeta<S extends SettingsSchema = SettingsSchema> {
    /** 아스키 id. storage 키(refresher:module:<id>:…)와 저장값의 키로 쓰인다. */
    id: string;
    /** 표시명 (한글). */
    name: string;
    description: string;
    /** 팝업 모듈 타일 아이콘. 배경 스크립트가 import하는 파일에 두면 React가 배경 번들에 딸려 간다 (features/imagesearch 참고). */
    icon: LucideIcon;
    /** 모듈이 돌 URL. 없으면 모든 페이지, []면 어느 페이지에서도 돌지 않는다(설정도 읽지 않는다). */
    urls?: RegExp[];
    /** 최초 활성 여부 (기본: true). */
    defaultEnable?: boolean;
    /** 설정 스키마 (옵션 페이지에서 렌더링됨). */
    settings?: S;
    /** 팝업 '현재 페이지' 토글의 표시 정보. index.ts의 pageToggles가 같은 객체를 펼쳐 동작을 붙인다. */
    toggles?: readonly PageToggleMeta[];

    /**
     * 브라우저 단축키 (manifest commands). 키는 명령 이름이고 index.ts의 shortcuts가 같은 이름으로 동작을 붙인다.
     * 빌드할 때 modules/commands.ts가 모아 manifest에 넣는다. 설명은 "모듈 이름: description"으로 보인다.
     * key는 처음 설치할 때의 기본 키다 (브라우저 단축키 설정에서 바꾼다). 없으면 사용자가 정해야 쓴다.
     */
    commands?: Record<string, { description: string; key?: string }>;

    /** 모듈이 켜져 있을 때 확장 페이지(옵션·팝업)의 <html>에 넣을 CSS 변수 (폰트 교체 등). 디시 페이지에는 setup이 따로 적용한다. */
    extensionPageVars?(settings: SettingValues<S>): Record<`--${string}`, string>;
}

/**
 * 기능 모듈. S는 설정 스키마, Api는 setup()의 리턴값으로 단축키·팝업 토글에 넘어간다.
 * 객체 리터럴에서 setup을 shortcuts·pageToggles보다 앞에 둔다. Api를 setup에서 먼저 추론해야 뒤쪽 함수의 인자 타입이 정해진다.
 */
export interface ModuleDefinition<S extends SettingsSchema = SettingsSchema, Api = unknown> extends ModuleMeta<S> {
    /** 모듈을 켤 때 실행. 리턴값은 shortcuts·pageToggles에 api로 전달된다. */
    setup(ctx: ModuleContext<S>): Api | Promise<Api>;

    /** 단축키. 키는 메타의 commands 이름이다. setup이 끝난 모듈에만 전달된다. */
    shortcuts?: Record<string, (ctx: ModuleContext<S>, api: Api) => void | Promise<void>>;

    /** 팝업 '현재 페이지' 토글 (메타의 toggles에 동작을 붙인 것). */
    pageToggles?: PageToggle<Api>[];

    /**
     * 모듈을 끌 때 실행 (DOM 정리 등). 리스너(signal)·cleanup은 이미 풀린 뒤다.
     * 콘텐츠 스크립트 컨텍스트가 무효화될 때(stopAll)는 부르지 않는다.
     */
    revoke?(): void;
}

/**
 * getModuleApi(id)가 돌려주는 api 타입 (모듈 id → setup()의 리턴값).
 * 손으로 채우지 않는다. modules/module-types.ts(WXT 모듈)가 features/*\/index.ts를 모아 .wxt/types/modules.d.ts에서 채운다.
 */
export interface ModuleApis {}

/** defineModule이 돌려주는 모듈. 레지스트리에는 AnyModule로 넘기고, id와 setup의 리턴값은 타입에만 남긴다 (ModuleApis 생성용). */
export type DefinedModule<Id extends string, Api> = AnyModule & { readonly id: Id; readonly apiType?: Api };

/**
 * useModuleSettings(id)가 돌려주는 설정 타입 (모듈 id → 설정값). ModuleApis처럼 modules/module-types.ts가 features/*\/meta.ts를 모아 채운다.
 */
export interface ModuleSettings {}

/** 모듈 메타를 모아 ModuleSettings 모양으로 만든다. 설정이 없는 모듈은 뺀다. */
export type ModuleSettingsMap<M> = {
    [K in M as K extends { id: infer Id extends string; settings?: infer S } ? (NonNullable<S> extends SettingsSchema ? ({} extends NonNullable<S> ? never : Id) : never) : never]:
    K extends { settings?: infer S } ? (NonNullable<S> extends SettingsSchema ? SettingValues<NonNullable<S>> : never) : never;
};

/** 모듈 id·api를 모아 ModuleApis 모양으로 만든다. api가 없는(void) 모듈은 뺀다. */
export type ModuleApiMap<M> = {
    [K in M as K extends DefinedModule<string, infer Api> ? ([Api] extends [void] ? never : K["id"]) : never]: K extends DefinedModule<string, infer Api> ? Api : never;
};

/** 레지스트리가 모듈을 모아 다룰 때의 타입. 모듈별 설정·api 타입은 defineModule에서 지운다. */
export type AnyModule = ModuleDefinition<SettingsSchema, unknown>;

/** 옵션·팝업이 모듈 메타를 모아 다룰 때의 타입. */
export type AnyModuleMeta = ModuleMeta<SettingsSchema>;
