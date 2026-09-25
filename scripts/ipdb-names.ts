/**
 * 국내 기관명 축약 — 배지가 짧게 보이도록.
 * 1) 법인 표기 제거  2) 통째로 바꾸는 프리셋  3) 한글로 적힌 영문 그룹명 앞말 → 영문  4) 여자대학교 → 여대, 대학교 → 대
 */

/** 법인 표기 제거 후의 이름 → 축약 (규칙으로 안 되는 것만) */
const PRESETS: Record<string, string> = {
    케이티: "KT",
    에스케이텔레콤: "SKT",
    엘지유플러스: "LG U+",
    삼성에스디에스: "삼성SDS",
    엘지씨엔에스: "LG CNS",
    케이티앤지: "KT&G",
    부산외국어대학교: "부산외대",
    한국외국어대학교: "한국외대",
    서울과학기술대학교: "서울과기대",
    한국과학기술원: "KAIST",
    포항공과대학교: "포스텍",
    광주과학기술원: "GIST",
    울산과학기술원: "UNIST",
    대구경북과학기술원: "DGIST",
    한국과학기술정보연구원: "KISTI",
    한국인터넷진흥원: "KISA",
    국가정보자원관리원: "국정자원"
};

/** 이름 앞의 한글 표기 그룹명 */
const PREFIXES: [string, string][] = [
    ["케이티에이치씨엔", "KT HCN"],
    ["에스케이", "SK"],
    ["엘지", "LG"],
    ["케이티", "KT"],
    ["씨제이", "CJ"],
    ["엔에이치엔", "NHN"]
];

const LEGAL_FORMS = /주식회사|유한회사|유한책임회사|\(주\)|\(유\)|㈜|재단법인|사단법인|\(재\)|\(사\)/g;

export const shortenOrg = (name: string): string => {
    const base = name.replace(LEGAL_FORMS, "").replace(/\s+/g, " ").trim();
    if (!base) return name;

    const preset = PRESETS[base];
    if (preset) return preset;

    const prefix = PREFIXES.find(([from]) => base.startsWith(from));
    const withPrefix = prefix ? prefix[1] + base.slice(prefix[0].length) : base;

    return withPrefix.replace(/여자대학교/g, "여대").replace(/대학교/g, "대");
};
