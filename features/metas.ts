import type { AnyModuleMeta } from "@/core/module/types";

// 콘텐츠 스크립트용 가벼운 메타 목록. 구현체는 features/index.ts의 lazy glob이 켜졌을 때만 청크로 받는다.
const metas = Object.values(
  import.meta.glob<AnyModuleMeta>("./*/meta.ts", { eager: true, import: "default" }),
);

export default metas;
