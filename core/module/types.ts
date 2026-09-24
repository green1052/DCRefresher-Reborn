import type {FilterOptions} from "@/core/filtering";
import type {TypedEventBus} from "@/core/eventbus/bus";
import type {ModuleEventMap} from "@/core/eventbus/types";
import type {JsonValue, SettingValue} from "@/core/storage/types";

export type SettingSchema =
    | {type: "check"; name: string; desc: string; default: boolean}
    | {type: "text"; name: string; desc: string; default: string; placeholder?: string}
    | {type: "range"; name: string; desc: string; default: number; min: number; max: number; step: number; unit: string}
    | {type: "option"; name: string; desc: string; default: string; items: Record<string, string>}
    | {type: "order"; name: string; desc: string; default: string[]; items: Record<string, string>};

export interface ModuleContext {
    /** 모듈 id */
    id: string;
    /** 현재 모듈의 설정값 (live, 읽기 전용) */
    settings: Readonly<Record<string, SettingValue>>;
    /** 모듈 영속 데이터 (Proxy, 변경시 즉시 저장) */
    data: Record<string, JsonValue>;
    /** 모듈 간 이벤트 버스 */
    bus: TypedEventBus<ModuleEventMap>;
    /** 요소 필터 등록. 해제 함수 반환 (disable시 자동 해제) */
    addFilter(scope: string, callback: (element: HTMLElement) => void, options?: FilterOptions): () => void;
    /** 해제 함수 등록 (이벤트 리스너, DOM 리스너 등). disable시 자동 해제 */
    addCleanup(dispose: () => void): void;
}

export interface ModuleDefinition {
    /** 아스키 id (storage 키, 저장 값과 연결) */
    id: string;
    /** 표시명 (한글) */
    name: string;
    description: string;
    /** 해당 모듈이 작동할 URL. 미지정시 항상 활성 범위 */
    urls?: RegExp[];
    /** 최초 1회 활성 여부 (기본: true) */
    defaultEnable?: boolean;
    /** 설정 스키마 (popup의 모듈 탭에서 렌더링됨) */
    settings?: Record<string, SettingSchema>;
    /** 활성화시 실행. 리턴값은 다른 모듈이 modules.use(id)로 접근하는 공개 API */
    setup(ctx: ModuleContext): unknown | void;
    /** 비활성화시 실행 (DOM 정리 등). cleanup(disposer)은 이후 자동 해제 */
    revoke?(ctx: ModuleContext): void;
    /** 활성 중 설정이 변경됐을 때 실행 */
    onChanged?(key: string, value: SettingValue): void;
    /** 단축키 (commands). registry가 활성 모듈에만 전달. api = setup()의 리턴값 */
    shortcuts?: Record<string, (ctx: ModuleContext, api: unknown) => void | Promise<void>>;
}

/** popup이 렌더링할 모듈 스키마 (JSON-serializable) */
export interface ModuleSchema {
    id: string;
    name: string;
    description: string;
    enable: boolean;
    running: boolean;
    defaultEnable: boolean;
    settings?: Record<string, SettingSchema>;
    /** 설정 현재값. settings 키와 1:1 (settings가 없으면 없음) */
    values?: Record<string, SettingValue>;
}

/** 다른 모듈이 사용할 수 있는 읽기 전용 핸들 */
export interface ModuleHandle {
    id: string;
    name: string;
    enable: boolean;
    running: boolean;
    settings: Readonly<Record<string, SettingValue>>;
    data: Readonly<Record<string, JsonValue>>;
    /** setup()의 리턴값. 비활성/미실행이면 undefined */
    api?: unknown;
}
