import type {LucideIcon} from "lucide-preact";

/** 설정 묶음. 같은 group의 설정을 옵션 화면에서 한 칸으로 모은다. */
export interface SettingGroup {
    name: string;
    desc: string;
}

/** 설정 하나의 표시 문구 (features/<id>/labels.ts). */
export interface SettingLabel {
    name: string;
    desc: string;
    group?: SettingGroup;
    placeholder?: string;
}

export type SettingSchema =
    | { type: "check"; default: boolean }
    /** maxLength: 저장·가져온 값도 자르는 글자 수 상한. */
    | { type: "text"; default: string; maxLength?: number }
    | { type: "range"; default: number; min: number; max: number; step: number; unit: string }
    | { type: "option"; default: string; items: Record<string, string> }
    /** default가 readonly여야 defineModule의 const 추론(readonly 튜플)을 받을 수 있다. */
    | { type: "order"; default: readonly string[]; items: Record<string, string> }
    | { type: "color"; default: string }
    /** 키 하나 (소문자 영문, 숫자). */
    | { type: "key"; default: string };

/** 표시 문구를 붙인 설정 (옵션 화면이 그린다). */
export type LabeledSetting = SettingSchema & SettingLabel;

export type SettingsSchema = Record<string, SettingSchema>;

type SettingValueOf<T extends SettingSchema> =
    T extends { type: "check" } ? boolean
        : T extends { type: "range" } ? number
            : T extends { type: "option"; items: infer I } ? keyof I & string
                : T extends { type: "order"; items: infer I } ? (keyof I & string)[]
                    : string;

/** 스키마로 만든 설정값 타입 (ctx.settings). */
export type SettingValues<S extends SettingsSchema> = { readonly [K in keyof S]: SettingValueOf<S[K]> };

export interface ModuleContext<S extends SettingsSchema = SettingsSchema> {
    /** 현재 설정값. 레지스트리가 객체를 갱신해 늘 최신이다. */
    settings: SettingValues<S>;
    /** 이 실행의 수명. 멈추면 abort된다. */
    signal: AbortSignal;

    /** scope에 맞는 요소마다 callback. 멈추면 자동으로 풀린다. */
    addFilter(scope: string, callback: (element: HTMLElement) => void): () => void;

    /** signal 없는 해제 함수 등록. 멈출 때 부른다. */
    addCleanup(dispose: () => void): void;

    /** 설정이 바뀌면 바뀐 키들로 한 번 부른다. await 전에 등록해야 그사이 변화도 받는다. */
    onSettingsChanged(listener: (keys: ReadonlySet<keyof S & string>) => void): void;

    /** 모듈을 끌 때의 정리 함수. stopAll(무효화) 때는 안 불러 가린 내용이 드러나지 않게 한다. */
    onRevoke(revoke: () => void): void;
}

/** 메타의 설정 스키마. 설정이 없으면 {}다. */
export type SchemaOf<M extends AnyModuleMeta> = NonNullable<M["settings"]>;

export type ToggleKeyOf<M extends AnyModuleMeta> = NonNullable<M["toggles"]>[number];

export type CommandKeyOf<M extends AnyModuleMeta> = keyof NonNullable<M["commands"]> & string;

/** 아이콘 모음. meta.ts는 배경 번들에도 들어가 React 아이콘을 두지 않는다. */
export type IconsOf<M extends AnyModuleMeta> = { module: LucideIcon } &
    ([ToggleKeyOf<M>] extends [never] ? { toggles?: never } : { toggles: Record<ToggleKeyOf<M>, LucideIcon> });

export interface AnyModuleIcons {
    module: LucideIcon;
    toggles?: Partial<Record<string, LucideIcon>>;
}

/** 표시 글 모음. meta.ts는 배경 번들에도 들어가 글을 두지 않는다. */
export type LabelsOf<M extends AnyModuleMeta> = { name: string; description: string } &
    ({} extends SchemaOf<M> ? { settings?: never } : { settings: Record<keyof SchemaOf<M>, SettingLabel> }) &
    ([ToggleKeyOf<M>] extends [never] ? { toggles?: never } : { toggles: Record<ToggleKeyOf<M>, string> }) &
    ([CommandKeyOf<M>] extends [never] ? { commands?: never } : { commands: Record<CommandKeyOf<M>, string> });

export interface AnyModuleLabels {
    name: string;
    description: string;
    settings?: Partial<Record<string, SettingLabel>>;
    toggles?: Partial<Record<string, string>>;
    commands?: Partial<Record<string, string>>;
}

/** 메타에 표시 문구와 아이콘을 합친 것 (features/meta.ts). */
export interface ModuleInfo extends Omit<AnyModuleMeta, "settings"> {
    name: string;
    description: string;
    settings?: Record<string, LabeledSetting>;
    labels: AnyModuleLabels;
    icons: AnyModuleIcons;
}

/** 팝업 '현재 페이지' 토글의 동작. desc가 함수면 열 때마다 계산한다. */
interface PageToggleImpl<Api> {
    desc: string | ((api: Api) => string);
    isOn(api: Api): boolean;
    toggle(api: Api): void;
}

/** 메타의 토글 id에 동작을 붙인 토글 (defineModule이 합친다). */
interface PageToggle<Api = unknown> extends PageToggleImpl<Api> {
    id: string;
}

/** 모듈 정보. 옵션, 팝업은 meta.ts만 불러 설정 코드가 번들에 딸려 가지 않게 한다. */
export interface ModuleMeta<S extends SettingsSchema = SettingsSchema, T extends string = string, C extends string = string> {
    /** storage 키로 쓰이는 아스키 id. */
    id: string;
    /** 돌 URL. 없으면 전부, []면 어디서도 안 돈다. */
    urls?: RegExp[];
    defaultEnable?: boolean;
    settings?: S;
    /** 팝업 토글 id. index.ts가 동작을 붙인다. */
    toggles?: readonly T[];

    /** 브라우저 단축키(명령 이름 → {key}). index.ts의 shortcuts가 동작을 붙인다. */
    commands?: Record<C, { key?: string }>;

    /** 켜져 있을 때 확장 페이지에 넣을 CSS 변수. 디시 페이지는 setup이 따로 적용한다. */
    extensionPageVars?(settings: SettingValues<S>): Record<`--${string}`, string>;
}

/** 메타에 붙이는 동작. 조건부 타입에 Api를 넣으면 setup이 Api를 추론하지 못한다(멤버 순서도 그 때문). */
export type ModuleImpl<M extends AnyModuleMeta, Api> = ModuleImplBase<M, Api>
    & ([CommandKeyOf<M>] extends [never] ? { shortcuts?: never } : { shortcuts: object })
    & ([ToggleKeyOf<M>] extends [never] ? { pageToggles?: never } : { pageToggles: object });

interface ModuleImplBase<M extends AnyModuleMeta, Api> {
    setup(ctx: ModuleContext<SchemaOf<M>>): Api | Promise<Api>;

    /** 단축키. setup이 끝난 모듈에만 전달된다. */
    shortcuts?: Record<CommandKeyOf<M>, (api: Api) => void | Promise<void>>;

    /** 팝업 '현재 페이지' 토글의 동작. */
    pageToggles?: Record<ToggleKeyOf<M>, PageToggleImpl<Api>>;

}

/** 동작의 타입을 지운 것. defineModule이 레지스트리에 넘기려고 쓴다. */
export interface AnyModuleImpl {
    setup(ctx: ModuleContext): unknown;
    shortcuts?: Partial<Record<string, (api: unknown) => void | Promise<void>>>;
    pageToggles?: Partial<Record<string, PageToggleImpl<unknown>>>;
}

/** 메타와 동작을 합친, 레지스트리가 다루는 모듈. */
export interface ModuleDefinition<S extends SettingsSchema = SettingsSchema, Api = unknown> extends ModuleMeta<S> {
    setup(ctx: ModuleContext<S>): Api | Promise<Api>;

    /** 단축키. setup이 끝난 모듈에만 전달된다. */
    shortcuts?: Partial<Record<string, (api: Api) => void | Promise<void>>>;

    /** 페이지 토글 (toggles에 동작을 붙인 것). */
    pageToggles?: PageToggle<Api>[];
}

/** 모듈 id → api 타입. WXT 모듈이 .wxt/types에서 채운다(손으로 쓰지 않는다). */
export interface ModuleApis {}

/** defineModule의 반환. id와 apiType은 ModuleApis 생성용 타입이다. */
export type DefinedModule<Id extends string, Api> = AnyModule & { readonly id: Id; readonly apiType?: Api };

/** 모듈 id → 설정값 타입. ModuleApis처럼 WXT 모듈이 채운다. */
export interface ModuleSettings {}

/** 모듈 메타를 모아 ModuleSettings 모양으로 만든다. 설정이 없는 모듈은 뺀다. */
export type ModuleSettingsMap<M> = {
    [K in M as K extends { id: infer Id extends string; settings?: infer S } ? (NonNullable<S> extends SettingsSchema ? ({} extends NonNullable<S> ? never : Id) : never) : never]:
    K extends { settings?: infer S } ? (NonNullable<S> extends SettingsSchema ? SettingValues<NonNullable<S>> : never) : never;
};

/** 모듈 id, api를 모아 ModuleApis 모양으로 만든다. api가 없는(void) 모듈은 뺀다. */
export type ModuleApiMap<M> = {
    [K in M as K extends DefinedModule<string, infer Api> ? ([Api] extends [void] ? never : K["id"]) : never]: K extends DefinedModule<string, infer Api> ? Api : never;
};

/** 레지스트리가 모듈을 모아 다룰 때의 타입. 모듈별 설정, api 타입은 defineModule에서 지운다. */
export type AnyModule = ModuleDefinition<SettingsSchema, unknown>;

export type AnyModuleMeta = ModuleMeta<SettingsSchema>;
