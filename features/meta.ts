import type {AnyModuleMeta} from "@/core/module/types";

/**
 * 모듈 메타 목록 (옵션·팝업·stores/modules용). index.ts를 모으는 features/index.ts와 같은 순서(경로순)다.
 * index.ts를 모으면 모듈의 setup이 쓰는 HTTP 클라이언트·캐시·미리보기 요청 코드까지 옵션·팝업 번들에 들어간다.
 */
const modules = import.meta.glob<{ default: AnyModuleMeta }>("./*/meta.ts", {eager: true});

const metas: AnyModuleMeta[] = Object.values(modules).map((module) => module.default);

export default metas;
