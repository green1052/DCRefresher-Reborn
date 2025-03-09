import type Frame from "../core/frame";

export {};

type ItemToRefresherArrayArgs<T extends RefresherModuleGeneric> =
    T["require"] extends Array<keyof ItemToRefresherMap>
        ? {
              [K in keyof T["require"]]: T["require"][K] extends keyof ItemToRefresherMap
                  ? ItemToRefresherMap[T["require"][K]]
                  : never;
          }
        : never;

declare global {
    interface ItemToRefresherMap {
        filter: RefresherFilter;
        Frame: typeof Frame;
        eventBus: RefresherEventBus;
        http: RefresherHTTP;
        ip: RefresherIP;
        block: RefresherBlock;
        dom: RefresherDOM;
        memo: RefresherMemo;
    }

    type RefresherSettings =
        | RefresherCheckSettings
        | RefresherTextSettings
        | RefresherRangeSettings
        | RefresherOptionSettings;

    interface RefresherBaseSettings<Type extends string, Value> {
        type: Type;
        name: string;
        desc: string;
        value: Value;
        default: Value;
        advanced?: boolean;
    }

    interface RefresherCheckSettings extends RefresherBaseSettings<"check", boolean> {}

    interface RefresherTextSettings extends RefresherBaseSettings<"text", string> {}

    interface RefresherRangeSettings extends RefresherBaseSettings<"range", number> {
        min: number;
        max: number;
        step: number;
        unit: string;
    }

    interface RefresherOptionSettings extends RefresherBaseSettings<"option", string> {
        items: unknown;
    }

    interface RefresherModuleGeneric {
        data?: Record<string, unknown>;
        memory?: Record<string, unknown>;
        settings?: Record<string, RefresherSettings>;
        shortcuts?: Record<string, () => void>;
        require?: Array<keyof ItemToRefresherMap>;
    }

    interface RefresherModule<T extends RefresherModuleGeneric = RefresherModuleGeneric> {
        /**
         * 모듈의 이름. 다른 모듈과 구별 짓는 값으로 사용되니 다른 모듈과 이름이 겹칠 수 없습니다.
         * 설정의 모듈 페이지에 표시됩니다.
         */
        name: string;

        /**
         * 모듈의 설정. 설정의 모듈 페이지에 표시됩니다.
         */
        description: string;

        /**
         * 해당 모듈이 작동할 URL regex.
         */
        url?: RegExp;

        /**
         * 해당 모듈이 가질 상탯값. 모듈 설정 저장용으로 사용됩니다.
         */
        status: T["settings"] extends Record<string, RefresherSettings>
            ? { [K in keyof T["settings"]]: T["settings"][K]["default"] }
            : never;

        /**
         * 모듈 데이터를 영속적으로 저장하고 싶을 때 사용하는 객체. 이 객체에 값을 저장하면 확장 프로그램이 로드될 때 마다 해당 값을 불러옵니다.
         */
        data?: T["data"];

        /**
         * 해당 모듈이 가질 메모리 값. 모듈에 일시적으로 데이터를 저장하고 싶을 때 사용됩니다.
         */
        memory: T["memory"];

        /**
         * 모듈을 사용 설정할지에 대한 여부 값. 사용자가 설정하는 값이므로 가급적 프로그램적으로 이 값을 변경하지 마세요.
         */
        enable: boolean;

        /**
         * 해당 모듈이 처음 로드될 때 해당 모듈을 사용 설정할지에 대한 여부입니다. (기본 내장 모듈만 해당)
         */
        default_enable: boolean;

        /**
         * 설정 페이지에 등록할 설정 옵션
         */
        settings?: T["settings"];

        /**
         * 단축키가 입력되면 실행할 함수를 정의합니다.
         */
        shortcuts: T["shortcuts"] extends Record<string, () => void>
            ? Record<keyof T["shortcuts"], (this: this) => void>
            : never;

        /**
         * 설정이 업데이트 됐을 시 호출할 함수를 정의합니다.
         */
        update: T["settings"] extends Record<string, RefresherSettings>
            ? {
                  [K in keyof T["settings"]]: (
                      this: any,
                      value: T["settings"][K]["value"],
                      ...args: ItemToRefresherArrayArgs<T>
                  ) => void;
              }
            : never;

        /**
         * 모듈에서 사용할 내장 유틸 목록.
         */
        require?: T["require"] extends Array<keyof ItemToRefresherMap> ? T["require"] : never;

        /**
         * 해당 모듈이 작동할 때를 처리하기 위한 함수. require에서 적어 넣은 변수 순서대로의 인자를 인자로 넘겨줍니다.
         */
        func?: (...args: ItemToRefresherArrayArgs<T>) => void;

        /**
         * 해당 모듈이 회수될 때 (비활성화될 때) 를 처리하기 위한 함수. require에서 적어 넣은 변수 순서대로의 인자를 인자로 넘겨줍니다.
         */
        revoke?: (...args: ItemToRefresherArrayArgs<T>) => void;
    }
}
