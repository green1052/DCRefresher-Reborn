export const urls = {
    base: "https://gall.dcinside.com/",
    gall: {
        major: "https://gall.dcinside.com/",
        mini: "https://gall.dcinside.com/mini/",
        minor: "https://gall.dcinside.com/mgallery/"
    },
    view: "board/view/?id=",
    vote: "https://gall.dcinside.com/board/recommend/vote",
    captcha: "https://gall.dcinside.com/kcaptcha/session",
    manage: {
        delete:
            "https://gall.dcinside.com/ajax/minor_manager_board_ajax/delete_list",
        deleteMini:
            "https://gall.dcinside.com/ajax/mini_manager_board_ajax/delete_list",
        deleteUser: "https://gall.dcinside.com/board/forms/delete_submit",
        deleteComment:
            "https://gall.dcinside.com/ajax/minor_manager_board_ajax/delete_comment",
        deleteCommentMini:
            "https://gall.dcinside.com/ajax/mini_manager_board_ajax/delete_comment",
        setNotice:
            "https://gall.dcinside.com/ajax/minor_manager_board_ajax/set_notice",
        setNoticeMini:
            "https://gall.dcinside.com/ajax/mini_manager_board_ajax/set_notice",
        block:
            "https://gall.dcinside.com/ajax/minor_manager_board_ajax/update_avoid_list",
        blockMini:
            "https://gall.dcinside.com/ajax/mini_manager_board_ajax/update_avoid_list",
        setRecommend:
            "https://gall.dcinside.com/ajax/minor_manager_board_ajax/set_recommend",
        setRecommendMini:
            "https://gall.dcinside.com/ajax/mini_manager_board_ajax/set_recommend"
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
    MINI: "mini"
};

export const commentGallTypes: { [index: string]: string } = {
    "": "G",
    mgallery: "M",
    mini: "MI"
};

export const heads = {
    "X-Requested-With": "XMLHttpRequest"
};

export const viewRegex = /\/board\/view\//g;
export const mgall = /dcinside\.com\/mgallery/g;

/**
 * ????????? ?????????????????? ???????????? boolean??? ???????????????.
 * @param url ????????? URL
 */
export const checkMinor = (url: string): boolean =>
    /\.com\/mgallery/g.test(url || location.href);

/**
 * ?????? ?????????????????? ???????????? boolean??? ???????????????.
 * @param url ????????? URL
 */
export const checkMini = (url: string): boolean =>
    /\.com\/mini/g.test(url || location.href);

/**
 * URL?????? ????????? ????????? ???????????? ???????????????.
 *
 * @param url ????????? ????????? ????????? URL.
 * @param extra ????????? ???????????? ?????? ???????????? ?????? URL suffix.
 */
export const galleryType = (url: string, extra?: string): string => {
    if (checkMinor(url)) {
        return types.MINOR + (extra && extra.length ? extra : "");
    } else if (checkMini(url)) {
        return types.MINI + (extra && extra.length ? extra : "");
    }

    return types.MAJOR;
};

/**
 * URL??? /board/view??? ???????????? ?????? ?????? /board/lists??? ???????????????.
 * @param url
 */
export const view = (url: string): string => {
    let type = galleryType(url);

    if (type === types.MINI) {
        type = urls.gall.mini;
    } else if (type === types.MINOR) {
        type = urls.gall.minor;
    } else {
        type = urls.gall.major;
    }

    const urlParse = new URL(url);
    const queries = new URLSearchParams(
        url.replace(urlParse.origin + urlParse.pathname, "")
    );

    if (queries.has("no")) {
        queries.delete("no");
    }

    return type + "board/lists?" + queries.toString();
};

export const make = (url: string, options?: RequestInit): Promise<string> =>
    new Promise<string>((resolve, reject) =>
        fetch(url, options)
            .then(async (response) => {
                if (response.status && response.status > 400) {
                    reject(`${response.status} ${response.statusText}`);
                }

                resolve(await response.text());
            })
            .catch((e) => {
                reject(e);
            })
    );

export const mergeParamURL = (origin: string, getFrom: string): string => {
    const add: { [index: string]: string } = {};

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
 * URL?????? ????????? ????????? ???????????? ????????? ?????? ????????? ???????????????.
 * (mgallery, mini, '')
 *
 * @param url
 */
export const galleryTypeName = (url: string): string => {
    return commentGallTypes[galleryType(url)];
};

/**
 * ?????? URL??? query??? ???????????????.
 *
 * @param name Query ??????
 */
export const queryString = (name: string): string | null =>
    new URLSearchParams(location.search).get(name);