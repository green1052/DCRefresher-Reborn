import type {AnyModule} from "@/core/module/types";

// 구현은 켜진 모듈만 늦게 평가한다(IIFE 단일 파일로 묶이므로 내려받기는 항상 전체).
const modules = import.meta.glob<AnyModule>("./*/index.ts", {import: "default"});

// glob 키 "./block/index.ts" → 모듈 id "block"
const loaders: Record<string, () => Promise<AnyModule>> = Object.fromEntries(
    Object.entries(modules).map(([path, load]) => [path.slice(2, -"/index.ts".length), load]),
);

export default loaders;
