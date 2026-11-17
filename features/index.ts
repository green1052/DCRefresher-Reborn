import type {AnyModule} from "@/core/module/types";

// 구현은 켜진 모듈만 늦게 받는다. 꺼진 모듈의 청크는 내려받지도 평가하지도 않는다.
// 파이어폭스 155 미만은 실패한 동적 import가 새로고침까지 캐시되므로 청크를 못 받으면 그 페이지에서 모듈이 죽는다.
const modules = import.meta.glob<AnyModule>("./*/index.ts", {import: "default"});

// glob 키 "./block/index.ts" → 모듈 id "block"
const loaders: Record<string, () => Promise<AnyModule>> = Object.fromEntries(
    Object.entries(modules).map(([path, load]) => [path.slice(2, -"/index.ts".length), load]),
);

export default loaders;
