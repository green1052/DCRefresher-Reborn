import {Puzzle} from "lucide-react";

import type {AnyModuleIcons, AnyModuleLabels, AnyModuleMeta, ModuleInfo} from "@/core/module/types";

/**
 * 모듈 목록 (옵션·팝업·stores/modules용). features/index.ts와 같은 경로순이다.
 * index.ts 대신 meta.ts만 모아야 setup이 쓰는 HTTP 클라이언트·캐시 코드가 옵션·팝업 번들에 들어가지 않는다.
 * 아이콘(icons.ts)과 표시 문구(labels.ts)는 배경·콘텐츠 번들에 들어가지 않게 meta.ts와 따로 두므로 여기서 합친다.
 */
const modules = import.meta.glob<AnyModuleMeta>("./*/meta.ts", {eager: true, import: "default"});
const icons = import.meta.glob<AnyModuleIcons>("./*/icons.ts", {eager: true, import: "default"});
const labels = import.meta.glob<AnyModuleLabels>("./*/labels.ts", {eager: true, import: "default"});

// icons.ts·labels.ts가 없으면 기본 아이콘·id로 그린다 (옵션·팝업이 같이 불러오므로 최상위에서 던지지 않는다). 빠뜨리면 단위 테스트가 잡는다.
const metas: ModuleInfo[] = Object.entries(modules).map(([path, meta]) => {
    const label = labels[path.replace(/meta\.ts$/, "labels.ts")] ?? {name: meta.id, description: ""};
    return {
        ...meta,
        name: label.name,
        description: label.description,
        // 옵션 화면은 설정마다 스키마와 표시 문구를 같이 그린다.
        settings: meta.settings && Object.fromEntries(Object.entries(meta.settings).map(([key, schema]) => [key, {...schema, ...label.settings?.[key] ?? {name: key, desc: ""}}])),
        labels: label,
        icons: icons[path.replace(/meta\.ts$/, "icons.ts")] ?? {module: Puzzle}
    };
});

export default metas;
