import {Puzzle} from "lucide-react";

import type {AnyModuleIcons, AnyModuleMeta} from "@/core/module/types";

/**
 * 모듈 메타 목록 (옵션·팝업·stores/modules용). features/index.ts와 같은 경로순이다.
 * index.ts 대신 meta.ts만 모아야 setup이 쓰는 HTTP 클라이언트·캐시 코드가 옵션·팝업 번들에 들어가지 않는다.
 * 아이콘(icons.ts)은 배경·콘텐츠 번들에 들어가지 않게 meta.ts와 따로 두므로 여기서 합친다.
 */
const modules = import.meta.glob<AnyModuleMeta>("./*/meta.ts", {eager: true, import: "default"});
const icons = import.meta.glob<AnyModuleIcons>("./*/icons.ts", {eager: true, import: "default"});

// icons.ts가 없으면 기본 아이콘으로 그린다 (옵션·팝업이 같이 불러오므로 최상위에서 던지지 않는다). 빠뜨리면 단위 테스트가 잡는다.
const metas: (AnyModuleMeta & { icons: AnyModuleIcons })[] = Object.entries(modules).map(([path, meta]) =>
    ({...meta, icons: icons[path.replace(/meta\.ts$/, "icons.ts")] ?? {module: Puzzle}}));

export default metas;
