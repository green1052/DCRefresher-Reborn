export const urls = {
    base: "https://gall.dcinside.com/",
    gall: {
        major: "https://gall.dcinside.com/",
        mini: "https://gall.dcinside.com/mini/",
        minor: "https://gall.dcinside.com/mgallery/",
        person: "https://gall.dcinside.com/person/"
    },
    view: "board/view/?id=",
    vote: "https://gall.dcinside.com/board/recommend/vote",
    captcha: "https://gall.dcinside.com/kcaptcha/session",
    manage: {
        bump: "https://gall.dcinside.com/ajax/minor_manager_board_ajax/update_bump",
        bumpMini: "https://gall.dcinside.com/ajax/mini_manager_board_ajax/update_bump",
        delete: "https://gall.dcinside.com/ajax/minor_manager_board_ajax/delete_list",
        deleteMini: "https://gall.dcinside.com/ajax/mini_manager_board_ajax/delete_list",
        deleteUser: "https://gall.dcinside.com/board/forms/delete_submit",
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
    comment_remove: "https://gall.dcinside.com/board/comment/comment_delete_submit",
    dccon: {
        detail: "https://gall.dcinside.com/dccon/package_detail",
        info: "https://dccon.dcinside.com/index/get_info",
        buy: "https://dccon.dcinside.com/index/buy"
    }
};

export const types = {
    MAJOR: "",
    MINOR: "mgallery",
    MINI: "mini",
    PERSON: "person"
};

export const commentGallTypes: Record<string, string> = {
    "": "G",
    mgallery: "M",
    mini: "MI",
    person: "PR"
};

export const viewRegex = /\/board\/view\//g;
export const mgall = /dcinside\.com\/mgallery/g;

/**
 * 마이너 갤러리인지를 확인하여 boolean을 반환합니다.
 * @param url 확인할 URL
 */
export const checkMinor = (url: string): boolean => /\.com\/mgallery/g.test(url || location.href);

/**
 * 미니 갤러리인지를 확인하여 boolean을 반환합니다.
 * @param url 확인할 URL
 */
export const checkMini = (url: string): boolean => /\.com\/mini/g.test(url || location.href);

/**
 * 인물 갤러리인지를 확인하여 boolean을 반환합니다.
 * @param url 확인할 URL
 */
export const checkPerson = (url: string): boolean => /\.com\/person/g.test(url || location.href);

/**
 * URL에서 갤러리 종류를 확인하여 반환합니다.
 *
 * @param url 갤러리 종류를 확인할 URL.
 * @param extra 마이너 갤러리와 미니 갤러리에 붙일 URL suffix.
 */
export const galleryType = (url: string, extra?: string): string => {
    if (checkMinor(url)) return types.MINOR + (extra ?? "");
    else if (checkMini(url)) return types.MINI + (extra ?? "");
    else if (checkPerson(url)) return types.PERSON + (extra ?? "");
    else return types.MAJOR;
};

/**
 * URL에 /board/view가 포함되어 있을 경우 /board/lists로 바꿔줍니다.
 */
export const view = (url: string): string => {
    const type = {
        [types.MINI]: urls.gall.mini,
        [types.MINOR]: urls.gall.minor,
        [types.MAJOR]: urls.gall.major,
        [types.PERSON]: urls.gall.person
    }[galleryType(url)];

    const urlParse = new URL(url);
    const queries = new URLSearchParams(url.replace(urlParse.origin + urlParse.pathname, ""));

    if (queries.has("no")) queries.delete("no");

    return type + "board/lists?" + queries.toString();
};

export const mergeParamURL = (origin: string, getFrom: string): string => {
    const add: Record<string, string> = {};

    const originURL = new URL(origin);
    for (const [key, value] of originURL.searchParams) {
        add[key] = value;
    }

    const fromURL = new URL(getFrom);
    for (const [key, value] of fromURL.searchParams) {
        add[key] = value;
    }

    return "?" + new URLSearchParams(add).toString();
};

/**
 * URL에서 갤러리 종류를 확인하여 갤러리 종류 이름을 반환합니다.
 * (mgallery, mini, '')
 */
export const galleryTypeName = (url: string): string => commentGallTypes[galleryType(url)];

/**
 * 현재 URL의 query를 가져옵니다.
 *
 * @param name Query 이름
 */
export const queryString = (name: string): string | null =>
    new URLSearchParams(location.search).get(name);
