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
    database: {
        version: "https://dcrefresher.green1052.com/version",
        ip: "https://dcrefresher.green1052.com/ip.json",
        ban: "https://dcrefresher.green1052.com/ban.json"
    }
};

/** 갤러리 종류별 경로 접두사, _GALLTYPE_ 값, 관리 API 접두사. 디시가 정한 값이라 바꾸면 안 된다. */
const GALLERIES = {
    normal: {path: "", galltype: "G", manager: "minor"},
    minor: {path: "mgallery/", galltype: "M", manager: "minor"},
    mini: {path: "mini/", galltype: "MI", manager: "mini"},
    person: {path: "person/", galltype: "PR", manager: "person"}
} as const;

type GalleryKind = keyof typeof GALLERIES;

/** https 디시 주소만 통과 - javascript:나 다른 사이트로 따라가지 않게. */
export const dcinsideHref = (url: string | URL | null | undefined): string | undefined => {
    const parsed = typeof url === "string" ? URL.parse(url) : url;
    return parsed?.protocol === "https:" && parsed.hostname.endsWith(".dcinside.com") ? parsed.href : undefined;
};

/** 주소의 경로 첫 칸으로 본다 - 전체에서 찾으면 검색어(s_keyword)에 든 글자에 걸린다. */
export const galleryKind = (url: string): GalleryKind => {
    const path = /^\/(mgallery|mini|person)\//.exec(URL.parse(url)?.pathname ?? "")?.[1];
    return path === "mgallery" ? "minor" : path === "mini" || path === "person" ? path : "normal";
};

/** URL의 갤러리 경로 접두사. */
export const galleryPath = (url: string): string => GALLERIES[galleryKind(url)].path;

/** 댓글, 관리, 캡차 요청에 넣는 _GALLTYPE_ 값. */
export const galltypeOf = (url: string): string => GALLERIES[galleryKind(url)].galltype;

/** 관리 API 주소 (ajax/<접두사>_manager_board_ajax/<action>). */
export const managerAjaxUrl = (url: string, action: string): string => `${urls.base}ajax/${GALLERIES[galleryKind(url)].manager}_manager_board_ajax/${action}`;

/** 같은 목록이면 같은 문자열이 나오게 글 보기 값(no, t), page=1을 빼고 쿼리를 정렬한다. */
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
    const params = new URL(origin).searchParams;
    for (const [key, value] of new URL(from).searchParams) params.set(key, value);
    return `?${params}`;
};

/** 디시 통합검색의 최신순 글 검색 주소. 검색어의 UTF-8 바이트를 검색창처럼 ".XX"로 쓴다. */
export const postSearchUrl = (query: string): string =>
    `https://search.dcinside.com/post/sort/latest/q/${Array.from(new TextEncoder().encode(query), (byte) => `.${byte.toString(16).padStart(2, "0").toUpperCase()}`).join("")}`;

/** 작성자 거르기가 목록 주소에 얹는 쿼리 이름 - 디시 글쓴이 검색은 닉네임만 찾는다. */
export const WRITER_PARAMS = {uid: "rf_uid", ip: "rf_ip"} as const;

export type WriterKind = keyof typeof WRITER_PARAMS;

export interface WriterFilter {
    kind: WriterKind;
    value: string;
}

/** 문서를 불러온 주소 - pushState로 주소창이 바뀌어도 문서가 보여 주는 페이지는 그대로다. */
const loadedDocumentUrl = (): URL => {
    // vitest가 performance를 통째로 바꿀 수 있고, Node 평가 시엔 location이 없어 선택 호출로 한다.
    const name = performance.getEntriesByType?.("navigation")[0]?.name ?? "";
    return URL.parse(name) ?? new URL(globalThis.location?.href ?? "https://gall.dcinside.com/");
};

/** 주소의 작성자 거르기. 기본은 문서를 불러온 주소다 (미리보기가 글 주소를 쌓아도). */
export const writerFilter = (href = loadedDocumentUrl().href): WriterFilter | null => {
    const params = new URL(href).searchParams;
    for (const kind of ["uid", "ip"] as const) {
        const value = params.get(WRITER_PARAMS[kind]);
        if (value) return {kind, value};
    }
    return null;
};

/** 이 문서를 불러온 주소의 쿼리 값 (미리보기가 주소를 바꿔도 그대로). */
export const queryString = (name: string): string | null => loadedDocumentUrl().searchParams.get(name);

/** 문서를 불러온 주소(내비게이션 항목). 주소창이 바뀌어도 문서의 페이지를 가린다. */
export const documentUrl = loadedDocumentUrl();
export const isViewPage = VIEW_PAGE.test(documentUrl.pathname);
export const pagePostNo = isViewPage ? documentUrl.searchParams.get("no") : null;
/** 이 문서의 갤러리 id. 미리보기가 주소를 바꿔도 그대로다. */
export const pageGallery = documentUrl.searchParams.get("id");

/** 목록 행의 글 번호. 글 보기 아래 목록의 행엔 data-no가 없어 제목 링크의 no를 쓴다. */
export const rowPostNo = (row: HTMLElement): string | undefined => {
    if (row.dataset.no) return row.dataset.no;

    const href = row.querySelector(".gall_tit > a")?.getAttribute("href");
    const params = href ? URL.parse(href, location.href)?.searchParams : undefined;
    return (params?.get("id") === pageGallery && params?.get("no")) || undefined;
};
