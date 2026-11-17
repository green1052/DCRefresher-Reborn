import type { AnyModuleMeta } from "@/core/module/types";

// 콘텐츠 스크립트용 가벼운 메타 목록. features/index.ts의 구현체 glob은 파이어폭스 청크 제약으로 eager를 유지한다.
const metas = Object.values(
  import.meta.glob<AnyModuleMeta>("./*/meta.ts", { eager: true, import: "default" }),
);

export default metas;
