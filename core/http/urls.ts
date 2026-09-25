export const urls = {
    base: "https://gall.dcinside.com/",
    vote: "https://gall.dcinside.com/board/recommend/vote",
    manage: {
        bump: "https://gall.dcinside.com/ajax/minor_manager_board_ajax/update_bump",
        bumpMini: "https://gall.dcinside.com/ajax/mini_manager_board_ajax/update_bump",
        delete: "https://gall.dcinside.com/ajax/minor_manager_board_ajax/delete_list",
        deleteMini: "https://gall.dcinside.com/ajax/mini_manager_board_ajax/delete_list",
        deleteComment: "https://gall.dcinside.com/ajax/minor_manager_board_ajax/delete_comment",
        deleteCommentMini: "https://gall.dcinside.com/ajax/mini_manager_board_ajax/delete_comment",
        setNotice: "https://gall.dcinside.com/ajax/minor_manager_board_ajax/set_notice",
        setNoticeMini: "https://gall.dcinside.com/ajax/mini_manager_board_ajax/set_notice",
        block: "https://gall.dcinside.com/ajax/minor_manager_board_ajax/update_avoid_list",
        blockMini: "https://gall.dcinside.com/ajax/mini_manager_board_ajax/update_avoid_list",
        setRecommend: "https://gall.dcinside.com/ajax/minor_manager_board_ajax/set_recommend",
        setRecommendMini: "https://gall.dcinside.com/ajax/mini_manager_board_ajax/set_recommend"
    },
    comments: "https://gall.dcinside.com/board/comment/",
    comments_submit: "https://gall.dcinside.com/board/forms/comment_submit",
    dccon_comments_submit: "https://gall.dcinside.com/dccon/insert_icon",
    txtcon_submit: "https://gall.dcinside.com/txtcon/insert",
    comment_remove: "https://gall.dcinside.com/board/comment/comment_delete_submit",
    dccon: {
        lists: "https://gall.dcinside.com/dccon/lists",
        detail: "https://gall.dcinside.com/dccon/package_detail"
    },
    // data 브랜치 — .github/workflows/db.yml이 만든다 (CORS 허용이라 호스트 권한 불필요)
    database: {
        version: "https://raw.githubusercontent.com/green1052/DCRefresher-Reborn/data/version",
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

/** 게시글/목록 URL → 같은 갤러리·쿼리의 목록 URL (no 제거) */
export const listUrl = (url: string): string => {
    const queries = new URL(url).searchParams;
    queries.delete("no");
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
