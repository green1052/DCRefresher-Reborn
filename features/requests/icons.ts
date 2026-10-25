import {Gauge} from "lucide-react";

import type {IconsOf} from "@/core/module/types";

import type meta from "./meta";

/** 옵션·팝업이 그리는 아이콘 (features/meta.ts가 모은다). meta.ts와 따로 두어 배경·콘텐츠 번들에 lucide·React가 딸려 가지 않게 한다. */
export default {module: Gauge} satisfies IconsOf<typeof meta>;
