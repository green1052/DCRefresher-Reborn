import type {ModuleEventData} from "@/core/eventbus/types";
import type {SettingValue} from "@/core/storage/types";
import type Emittery from "emittery";

/** 설정 묶음 — 같은 객체를 group으로 가진 설정을 옵션 화면에서 첫 설정 자리의 한 칸에 모아 보여준다 (값은 설정마다 따로) */
export interface SettingGroup {
    name: string;
    desc: string;
}

export type SettingSchema = { group?: SettingGroup } & (
    | { type: "check"; name: string; desc: string; default: boolean }
    | { type: "text"; name: string; desc: string; default: string; placeholder?: string }
    | {
    type: "range";
    name: string;
    desc: string;
    default: number;
    min: number;
    max: number;
    step: number;
    unit: string
}
    | { type: "option"; name: string; desc: string; default: string; items: Record<string, string> }
    | { type: "order"; name: string; desc: string; default: string[]; items: Record<string, string> }
    | { type: "color"; name: string; desc: string; default: string }
    /** 키 하나 (소문자 영문·숫자) */
    | { type: "key"; name: string; desc: string; default: string }
);

export interface ModuleContext {
    /** 현재 모듈의 설정값 (live, 읽기 전용) */
    settings: Readonly<Record<string, SettingValue>>;
    /** 모듈 간 이벤트 버스 */
    bus: Emittery<ModuleEventData>;

    /** 요소 필터 등록 — 지금 있는 요소 + 이후 추가되는 요소마다 실행. 해제 함수 반환 (disable시 자동 해제) */
    addFilter(scope: string, callback: (element: HTMLElement) => void): () => void;

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
    /** 최초 활성 여부 (기본: true) */
    defaultEnable?: boolean;
    /** 설정 스키마 (옵션 페이지에서 렌더링됨) */
    settings?: Record<string, SettingSchema>;
    /** 단축키 (commands). registry가 활성 모듈에만 전달. api = setup()의 리턴값 */
    shortcuts?: Record<string, (ctx: ModuleContext, api: unknown) => void | Promise<void>>;

    /** 활성화시 실행. 리턴값은 shortcuts에 api로 전달된다 */
    setup(ctx: ModuleContext): unknown | void;

    /** 비활성화시 실행 (DOM 정리 등). cleanup(disposer)은 이후 자동 해제 */
    revoke?(ctx: ModuleContext): void;

    /** 활성 중 설정이 변경됐을 때 실행 */
    onChanged?(ctx: ModuleContext, key: string, value: SettingValue): void;
}
