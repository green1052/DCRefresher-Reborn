import type {LabelsOf, SettingGroup, SettingLabel} from "@/core/module/types";

import type meta from "./meta";
import {ENGINE_IDS, ENGINES} from "./meta";

const ENGINE_GROUP: SettingGroup = {name: "검색 엔진", desc: "이미지 우클릭 메뉴에 넣을 검색 엔진입니다. 콘텐츠 차단의 '이 이미지 차단'까지 메뉴가 둘 이상이면 확장 이름 아래로 묶입니다."};

/** 옵션·팝업이 보이는 글 (features/meta.ts가 모은다). meta.ts와 따로 두어 배경·콘텐츠 번들에 들어가지 않게 한다. */
export default {
    name: "이미지 검색",
    description: "디시 이미지를 우클릭해 검색 엔진에서 찾습니다.",
    settings: Object.fromEntries(ENGINE_IDS.map((id) => [id, {group: ENGINE_GROUP, name: ENGINES[id].name, desc: `${ENGINES[id].name}에서 검색합니다.`}])) as
        Record<(typeof ENGINE_IDS)[number], SettingLabel>
} satisfies LabelsOf<typeof meta>;
