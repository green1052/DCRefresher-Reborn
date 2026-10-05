/** meta.ts와 background.ts가 같이 쓰는 엔진·설정. 배경 번들에 들어가므로 React를 불러오지 않는다. */
import type {SettingGroup, SettingSchema} from "@/core/module/types";

export const IMAGE_SEARCH_ID = "imagesearch";

/** 이미지 주소를 붙이면 바로 검색되는 GET 주소 (url 뒤에 encodeURIComponent(이미지 주소)). */
export const IMAGE_SEARCH_ENGINES: Record<string, { name: string; url: string }> = {
    saucenao: {name: "SauceNao", url: "https://saucenao.com/search.php?url="},
    googleLens: {name: "Google Lens", url: "https://lens.google.com/uploadbyurl?url="},
    yandex: {name: "Yandex", url: "https://yandex.com/images/search?rpt=imageview&url="},
    ascii2d: {name: "ascii2d", url: "https://ascii2d.net/search/url/"},
    tineye: {name: "TinEye", url: "https://tineye.com/search?url="},
    iqdb: {name: "IQDB", url: "https://iqdb.org/?url="},
    tracemoe: {name: "trace.moe", url: "https://trace.moe/?url="}
};

/** 메뉴를 띄울 이미지: imageSearchUrl이 바꿀 수 있는 디시 본문 이미지(viewimage.php — dcimg*.dcinside.co.kr, image.dcinside.com 등)만. */
export const IMAGE_URL_PATTERNS = ["*://*.dcinside.co.kr/viewimage.php*", "*://*.dcinside.com/viewimage.php*"];

/** 우클릭한 이미지를 engine으로 검색할 주소. 디시 본문 이미지가 아니면 null */
export const imageSearchUrl = (engine: string, src: string): string | null => {
    const prefix = IMAGE_SEARCH_ENGINES[engine]?.url;
    if (!prefix || !src.includes("viewimage.php")) return null;

    // 디시콘 주소(image.dcinside.com/dccon.php)로 바꾼다. 호스트·경로만 바꾸고 쿼리는 그대로 둔다.
    const url = new URL(src);
    url.host = "image.dcinside.com";
    url.pathname = "/dccon.php";

    return prefix + encodeURIComponent(url.toString());
};

const ENGINE_GROUP: SettingGroup = {name: "검색 엔진", desc: "이미지 우클릭 메뉴에 넣을 검색 엔진입니다. 둘 이상이면 확장 이름 아래로 묶입니다."};

/** 엔진마다 켜기/끄기. background.ts가 이 값으로 메뉴를 만든다. */
export const IMAGE_SEARCH_SETTINGS: Record<string, SettingSchema> = Object.fromEntries(
    Object.entries(IMAGE_SEARCH_ENGINES).map(([id, {name}]): [string, SettingSchema] => [
        id,
        {type: "check", group: ENGINE_GROUP, name, desc: `${name}에서 검색합니다.`, default: id === "saucenao"}
    ])
);
