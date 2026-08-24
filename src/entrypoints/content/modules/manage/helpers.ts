import http, {ajaxClient} from "@/http/http";

export const deletePost = async (id: string): Promise<void> => {
    if (!id) return;

    const params = http.createAuthParams(location.href);
    const galleryIdInput = document.querySelector<HTMLInputElement>("#gallery_id");
    params.set("id", galleryIdInput?.value ?? "");
    params.set("nos[]", id);

    try {
        await ajaxClient(http.manageUrl(location.href, http.urls.manage.deleteMini, http.urls.manage.delete), {
            body: params
        });
    } catch (e) {
        console.error("deletePost failed:", e);
    }
};

export const getPermBanFor = (
    uid: string,
    permBanIndex: Map<string, string[]>
): string | undefined => {
    if (!permBanIndex) return;

    const list = permBanIndex.get(uid);

    return list?.join(", ");
};

export interface RatioInfo {
    article: number;
    comment: number;
    date: number;
}

export const fetchRatio = async (uid: string): Promise<RatioInfo | undefined> => {
    const params = http.createAuthParams();
    params.set("user_id", uid);

    const response = await ajaxClient("https://gall.dcinside.com/api/gallog_user_layer/gallog_content_reple", {
        body: params
    }).text();

    const [article, comment] = response.split(",").map(Number);

    if (isNaN(article) || isNaN(comment)) return;

    return {article, comment, date: Date.now()};
};