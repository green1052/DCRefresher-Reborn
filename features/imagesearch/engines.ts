/** 이미지 검색에서 배경 스크립트도 쓰는 부분 — 모듈 파일(index.ts)은 아이콘(React)을 불러와 배경이 import하면 React가 딸려 간다 */
import type {SettingGroup, SettingSchema} from "@/core/module/types";

export const IMAGE_SEARCH_ID = "imagesearch";

/** 이미지 주소를 붙이면 바로 검색되는 GET 주소 (url 뒤에 encodeURIComponent(이미지 주소)) */
export const IMAGE_SEARCH_ENGINES: Record<string, { name: string; url: string }> = {
    saucenao: {name: "SauceNao", url: "https://saucenao.com/search.php?url="},
    googleLens: {name: "Google Lens", url: "https://lens.google.com/uploadbyurl?url="},
    yandex: {name: "Yandex", url: "https://yandex.com/images/search?rpt=imageview&url="},
    ascii2d: {name: "ascii2d", url: "https://ascii2d.net/search/url/"},
    tineye: {name: "TinEye", url: "https://tineye.com/search?url="},
    iqdb: {name: "IQDB", url: "https://iqdb.org/?url="},
    tracemoe: {name: "trace.moe", url: "https://trace.moe/?url="}
};

/** 메뉴를 띄울 이미지 — 아래 변환이 받는 디시 본문 이미지(viewimage.php)만 (dcimg*.dcinside.co.kr, image.dcinside.com 등) */
export const IMAGE_URL_PATTERNS = ["*://*.dcinside.co.kr/viewimage.php*", "*://*.dcinside.com/viewimage.php*"];

/** 우클릭한 이미지를 engine으로 검색할 주소. 디시 본문 이미지가 아니면 null */
export const imageSearchUrl = (engine: string, src: string): string | null => {
    const prefix = IMAGE_SEARCH_ENGINES[engine]?.url;
    if (!prefix || !src.includes("viewimage.php")) return null;

    // 디시콘 이미지로 통일 (호스트/경로만 교체, 쿼리 유지)
    const url = new URL(src);
    url.host = "image.dcinside.com";
    url.pathname = "/dccon.php";

    return prefix + encodeURIComponent(url.toString());
};

const ENGINE_GROUP: SettingGroup = {name: "검색 엔진", desc: "이미지 우클릭 메뉴에 넣을 검색 엔진입니다. 둘 이상이면 확장 이름 아래로 묶입니다."};

/** 엔진마다 켜기/끄기 — 메뉴는 배경이 이 설정을 보고 만든다 */
export const IMAGE_SEARCH_SETTINGS: Record<string, SettingSchema> = Object.fromEntries(
    Object.entries(IMAGE_SEARCH_ENGINES).map(([id, {name}]): [string, SettingSchema] => [
        id,
        {type: "check", group: ENGINE_GROUP, name, desc: `${name}에서 검색합니다.`, default: id === "saucenao"}
    ])
);
