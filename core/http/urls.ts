import {VIEW_PAGE} from "@/core/pages";

export const urls = {
    base: "https://gall.dcinside.com/",
    vote: "https://gall.dcinside.com/board/recommend/vote",
    comments: "https://gall.dcinside.com/board/comment/",
    comments_submit: "https://gall.dcinside.com/board/forms/comment_submit",
    dccon_comments_submit: "https://gall.dcinside.com/dccon/insert_icon",
    txtcon_submit: "https://gall.dcinside.com/txtcon/insert",
    comment_remove: "https://gall.dcinside.com/board/comment/comment_delete_submit",
    dccon: {
        lists: "https://gall.dcinside.com/dccon/lists",
        detail: "https://gall.dcinside.com/dccon/package_detail",
        buy: "https://gall.dcinside.com/dccon/buy",
        /** 디시콘 이미지. package_detail이 주는 경로(main_img_path, path)를 뒤에 붙인다. */
        image: "https://dcimg5.dcinside.com/dccon.php?no=",
        /** 디시콘 상점. 뒤에 /nick_name/{제작자}, /tags/{태그}를 붙인다. */
        shop: "https://dccon.dcinside.com/hot/1"
    },
    // data 브랜치는 .github/workflows/db.yml이 만들고, Cloudflare Pages가 그대로 배포한다. CORS를 열어 두어 호스트 권한이 필요 없다.
    // 6.0.3 이하는 raw.githubusercontent.com에서 받으므로 data 브랜치 게시는 계속 유지한다.
    database: {
        version: "https://dcrefresher.green1052.com/version",
        // 저장 형식 그대로다 (core/ipdb.ts의 CompactIpData).
        ip: "https://dcrefresher.green1052.com/ip.json",
        ban: "https://dcrefresher.green1052.com/ban.json"
    }
};

/**
 * 갤러리 종류별 주소 경로 접두사와 디시 요청의 _GALLTYPE_ 값. 디시가 정한 값이라 바꾸면 안 된다.
 * 코드에서는 종류 이름(GalleryKind)으로 다루고, 이 값들은 주소·요청을 만들 때만 꺼낸다.
 */
const GALLERIES = {
    normal: {path: "", galltype: "G"},
    minor: {path: "mgallery/", galltype: "M"},
    mini: {path: "mini/", galltype: "MI"},
    person: {path: "person/", galltype: "PR"}
} as const;

/** 갤러리 종류: 일반, 마이너, 미니, 인물. */
type GalleryKind = keyof typeof GALLERIES;

/**
 * https 디시 주소면 그 주소, 아니면 undefined. 페이지·본문에서 읽은 주소로 이동하거나 새 탭을 열기 전에 거친다.
 * javascript:나 다른 사이트 주소가 섞여 들어와도 따라가지 않는다.
 */
export const dcinsideHref = (url: string | URL | null | undefined): string | undefined => {
    const parsed = typeof url === "string" ? URL.parse(url) : url;
    return parsed?.protocol === "https:" && parsed.hostname.endsWith(".dcinside.com") ? parsed.href : undefined;
};

export const galleryKind = (url: string): GalleryKind => {
    const path = /\.com\/(mgallery|mini|person)/.exec(url)?.[1];
    return path === "mgallery" ? "minor" : path === "mini" || path === "person" ? path : "normal";
};

/** URL의 갤러리 경로 접두사 ("", "mgallery/", "mini/", "person/"). */
export const galleryPath = (url: string): string => GALLERIES[galleryKind(url)].path;

/** 댓글·관리·캡차 요청에 넣는 _GALLTYPE_ 값. */
export const galltypeOf = (url: string): string => GALLERIES[galleryKind(url)].galltype;

/**
 * 게시글/목록 URL → 같은 갤러리·쿼리의 목록 URL.
 * 같은 목록이면 같은 문자열이 되도록 글 보기 전용 값(no, t)과 page=1을 빼고 쿼리를 정렬한다.
 * 그래서 미리보기가 pushState로 바꾼 글 주소도 원래 목록과 같은 값이 나온다.
 */
export const listUrl = (url: string): string => {
    const queries = new URL(url).searchParams;
    queries.delete("no");
    queries.delete("t");
    queries.delete("page", "1");
    queries.sort();
    return `${urls.base}${galleryPath(url)}board/lists?${queries}`;
};

/** origin의 쿼리에 from의 쿼리를 덮어쓴 "?..." 문자열. */
export const mergeParamURL = (origin: string, from: string): string => {
    const params = new URLSearchParams(new URL(origin).search);
    for (const [key, value] of new URL(from).searchParams) params.set(key, value);
    return `?${params}`;
};

/** 디시 통합검색의 최신순 글 검색 주소. 검색창처럼 검색어의 UTF-8 바이트를 ".XX"로 쓴다 (%2F가 든 주소는 404다). */
export const postSearchUrl = (query: string): string =>
    `https://search.dcinside.com/post/sort/latest/q/${Array.from(new TextEncoder().encode(query), (byte) => `.${byte.toString(16).padStart(2, "0").toUpperCase()}`).join("")}`;

export const queryString = (name: string): string | null => new URLSearchParams(location.search).get(name);

/**
 * 이 문서를 불러온 주소. 미리보기·페이지 넘김이 pushState로 주소를 바꿔도 이 문서가 보여 주는 페이지는 그대로다.
 * 지금 주소가 아니라 내비게이션 항목에서 읽는다. 파이어폭스는 확장을 업데이트하면 미리보기가 바꿔 둔 글 주소에서 스크립트를 다시 주입한다.
 * 파이어폭스 확장 페이지(배경·옵션·팝업)는 항목 이름이 URL이 아니라 "document"라 파싱되지 않으면 지금 주소를 쓴다 (던지면 번들 전체가 멈춘다).
 */
export const documentUrl = URL.parse(performance.getEntriesByType("navigation")[0]?.name ?? "") ?? new URL(location.href);
export const isViewPage = VIEW_PAGE.test(documentUrl.pathname);
/** 글 보기 페이지가 보여 주는 글 번호. */
export const pagePostNo = isViewPage ? documentUrl.searchParams.get("no") : null;

/** 목록 행의 글 번호. 글 보기 아래 목록의 행에는 data-no가 없어 같은 갤러리로 가는 제목 링크의 no를 쓴다. */
export const rowPostNo = (row: HTMLElement): string | undefined => {
    if (row.dataset.no) return row.dataset.no;

    const href = row.querySelector(".gall_tit > a")?.getAttribute("href");
    const params = href ? URL.parse(href, location.href)?.searchParams : undefined;
    return (params?.get("id") === queryString("id") && params?.get("no")) || undefined;
};
