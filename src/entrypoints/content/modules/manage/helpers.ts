import Cookies from "js-cookie";
import http, {client as ky} from "@/http/http";

export const deletePost = async (id: string): Promise<void> => {
    if (!id) return;

    const galleryType = http.galleryType(location.href, "/");

    const params = new URLSearchParams();
    params.set("ci_t", Cookies.get("ci_c") ?? "");
    const galleryIdInput = document.querySelector<HTMLInputElement>("#gallery_id");
    params.set("id", galleryIdInput?.value ?? "");
    params.set("nos[]", id);
    params.set("_GALLTYPE_", http.galleryTypeName(location.href));

    try {
        await ky.post(galleryType === "mini/" ? http.urls.manage.deleteMini : http.urls.manage.delete, {
            headers: {
                "X-Requested-With": "XMLHttpRequest"
            },
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
    const params = new URLSearchParams();
    params.set("ci_t", Cookies.get("ci_c") ?? "");
    params.set("user_id", uid);

    const response = await ky
        .post("https://gall.dcinside.com/api/gallog_user_layer/gallog_content_reple", {
            body: params,
            headers: {
                "X-Requested-With": "XMLHttpRequest"
            }
        })
        .text();

    const [article, comment] = response.split(",").map(Number);

    if (isNaN(article) || isNaN(comment)) return;

    return {article, comment, date: Date.now()};
};