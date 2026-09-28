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
        detail: "https://gall.dcinside.com/dccon/package_detail"
    },
    // data 브랜치는 .github/workflows/db.yml이 만든다. raw.githubusercontent.com은 CORS를 허용해 호스트 권한이 필요 없다
    database: {
        version: "https://raw.githubusercontent.com/green1052/DCRefresher-Reborn/data/version",
        // 저장 형식 그대로다 (core/ipdb의 CompactIpData)
        ip: "https://raw.githubusercontent.com/green1052/DCRefresher-Reborn/data/ip.json",
        ban: "https://raw.githubusercontent.com/green1052/DCRefresher-Reborn/data/ban.json"
    }
};

/** URL의 갤러리 경로 접두사: 일반 "", 마이너 "mgallery/", 미니 "mini/", 인물 "person/" */
export const galleryPath = (url: string): string => {
    const type = /\.com\/(mgallery|mini|person)/.exec(url)?.[1];
    return type ? `${type}/` : "";
};

export const isMiniGallery = (url: string): boolean => galleryPath(url) === "mini/";

const GALLERY_TYPE_NAMES: Record<string, string> = {"": "G", "mgallery/": "M", "mini/": "MI", "person/": "PR"};

/** 댓글/관리 요청의 _GALLTYPE_ 코드 (G, M, MI, PR) */
export const galleryTypeName = (url: string): string => GALLERY_TYPE_NAMES[galleryPath(url)] ?? "G";

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

/** origin의 쿼리에 from의 쿼리를 덮어쓴 "?..." 문자열 */
export const mergeParamURL = (origin: string, from: string): string => {
    const params = new URLSearchParams(new URL(origin).search);
    for (const [key, value] of new URL(from).searchParams) params.set(key, value);
    return `?${params}`;
};

/** 현재 URL의 쿼리 값 */
export const queryString = (name: string): string | null => new URLSearchParams(location.search).get(name);

/**
 * 이 문서를 불러온 주소. 미리보기·페이지 넘김이 pushState로 주소를 바꿔도 이 문서가 보여 주는 페이지는 그대로다.
 * 지금 주소가 아니라 내비게이션 항목에서 읽는다. 파이어폭스는 확장을 업데이트하면 미리보기가 바꿔 둔 글 주소에서 스크립트를 다시 주입한다.
 * 파이어폭스 확장 페이지(배경·옵션·팝업)는 항목 이름이 URL이 아니라 "document"라 파싱되지 않으면 지금 주소를 쓴다 (던지면 번들 전체가 멈춘다)
 */
export const documentUrl = URL.parse(performance.getEntriesByType("navigation")[0]?.name ?? "") ?? new URL(location.href);
/** 글 보기 페이지인지 */
export const isViewPage = VIEW_PAGE.test(documentUrl.pathname);
/** 글 보기 페이지가 보여 주는 글 번호 */
export const pagePostNo = isViewPage ? documentUrl.searchParams.get("no") : null;

/** 목록 행의 글 번호. 글 보기 아래 목록의 행에는 data-no가 없어 같은 갤러리로 가는 제목 링크의 no를 쓴다 */
export const rowPostNo = (row: HTMLElement): string | undefined => {
    if (row.dataset.no) return row.dataset.no;

    const href = row.querySelector(".gall_tit > a")?.getAttribute("href");
    const params = href ? URL.parse(href, location.href)?.searchParams : undefined;
    return (params?.get("id") === queryString("id") && params?.get("no")) || undefined;
};
