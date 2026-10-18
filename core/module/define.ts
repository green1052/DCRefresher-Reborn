import type {AnyModuleImpl, AnyModuleMeta, DefinedModule, ModuleImpl, ModuleMeta, SettingsSchema} from "./types";

/**
 * 모듈 메타(features/<id>/meta.ts). 설정 스키마를 리터럴 그대로(const) 남겨, index.ts의 defineModule(meta, {setup})에서
 * ctx.settings의 키마다 정확한 타입이 나오게 한다. 토글 id(T)·명령 이름(C)도 리터럴로 남겨 index.ts의 pageToggles·shortcuts와
 * icons.ts가 이름마다 하나씩 두게 한다. 옵션·팝업은 features/meta.ts의 glob으로 이것만 모은다.
 */
export const defineModuleMeta = <const Id extends string, const S extends SettingsSchema = {}, const T extends string = never, const C extends string = never>(
    meta: ModuleMeta<S, T, C> & { id: Id }
): ModuleMeta<S, T, C> & { id: Id } => meta;

/**
 * 기능 모듈 정의. 메타(M)와 setup의 리턴값(Api)으로 ctx.settings·단축키·팝업 토글에 타입을 준다.
 * 팝업 토글은 메타의 표시 정보(id·label)에 동작을 붙여 레지스트리가 쓰는 목록으로 만든다.
 */
export const defineModule = <M extends AnyModuleMeta, Api = void>(meta: M, impl: ModuleImpl<M, Api>): DefinedModule<M["id"], Api> => {
    // 레지스트리는 여러 모듈을 한데 다루므로 api·명령·토글 이름의 타입을 여기서 지운다 (모듈 정의의 유일한 단언).
    // 타입 검사는 ModuleImpl<M, Api>에서 이미 끝났고, api를 받는 함수는 레지스트리가 그 모듈의 setup이 돌려준 값만 넘긴다.
    const {setup, shortcuts, pageToggles} = impl as AnyModuleImpl;
    return {
        ...meta,
        setup,
        shortcuts,
        pageToggles: meta.toggles?.flatMap((toggle) => {
            const action = pageToggles?.[toggle.id];
            return action ? [{...toggle, ...action}] : [];
        })
    };
};
