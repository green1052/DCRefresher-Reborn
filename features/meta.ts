import type {AnyModuleMeta} from "@/core/module/types";

/**
 * 모듈 메타 목록 (옵션·팝업·stores/modules용). features/index.ts와 같은 경로순이다.
 * index.ts 대신 meta.ts만 모아야 setup이 쓰는 HTTP 클라이언트·캐시 코드가 옵션·팝업 번들에 들어가지 않는다.
 */
const modules = import.meta.glob<{ default: AnyModuleMeta }>("./*/meta.ts", {eager: true});

const metas: AnyModuleMeta[] = Object.values(modules).map((module) => module.default);

export default metas;
