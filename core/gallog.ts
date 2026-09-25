import {http} from "@/core/http/client";
import {csrfToken} from "@/utils/cookie";

const GALLOG_API = "https://gall.dcinside.com/api/gallog_user_layer/gallog_content_reple";

export interface GallogActivity {
    article: number;
    comment: number;
}

/** 갤로그의 글/댓글 수 ("글,댓글" 텍스트 응답) */
export const fetchGallogActivity = async (uid: string): Promise<GallogActivity | undefined> => {
    const text = await http.post(GALLOG_API, {
        headers: {"X-Requested-With": "XMLHttpRequest"},
        body: new URLSearchParams({ci_t: await csrfToken(), user_id: uid})
    }).text();

    const [article, comment] = text.split(",").map(Number);
    if (article === undefined || comment === undefined || Number.isNaN(article) || Number.isNaN(comment)) return undefined;

    return {article, comment};
};
