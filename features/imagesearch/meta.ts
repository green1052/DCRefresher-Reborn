import {defineModuleMeta} from "@/core/module/define";
import type {SettingGroup, SettingSchema} from "@/core/module/types";
import {objectKeys} from "@/utils/typed";

/** 이미지 주소를 붙이면 바로 검색되는 GET 주소 (url 뒤에 encodeURIComponent(이미지 주소)). */
export const ENGINES = {
    saucenao: {name: "SauceNao", url: "https://saucenao.com/search.php?url="},
    googleLens: {name: "Google Lens", url: "https://lens.google.com/uploadbyurl?url="},
    yandex: {name: "Yandex", url: "https://yandex.com/images/search?rpt=imageview&url="},
    ascii2d: {name: "ascii2d", url: "https://ascii2d.net/search/url/"},
    tineye: {name: "TinEye", url: "https://tineye.com/search?url="},
    iqdb: {name: "IQDB", url: "https://iqdb.org/?url="},
    tracemoe: {name: "trace.moe", url: "https://trace.moe/?url="}
} satisfies Record<string, { name: string; url: string }>;

export const ENGINE_IDS = objectKeys(ENGINES);

const ENGINE_GROUP: SettingGroup = {name: "검색 엔진", desc: "이미지 우클릭 메뉴에 넣을 검색 엔진입니다. 콘텐츠 차단의 '이 이미지 차단'까지 메뉴가 둘 이상이면 확장 이름 아래로 묶입니다."};

export default defineModuleMeta({
    id: "imagesearch",
    name: "이미지 검색",
    description: "디시 이미지를 우클릭해 검색 엔진에서 찾습니다.",
    // 메뉴는 background.ts가 만들고 처리한다. 페이지에선 할 일이 없어 index.ts를 두지 않는다.
    // 엔진마다 켜기/끄기. background.ts가 이 값으로 메뉴를 만든다.
    settings: Object.fromEntries(ENGINE_IDS.map((id) => [
        id,
        {type: "check", group: ENGINE_GROUP, name: ENGINES[id].name, desc: `${ENGINES[id].name}에서 검색합니다.`, default: id === "saucenao"}
    ])) as Record<(typeof ENGINE_IDS)[number], Extract<SettingSchema, { type: "check" }>>
});
