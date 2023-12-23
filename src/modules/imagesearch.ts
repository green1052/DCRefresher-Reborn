import * as communicate from "../core/communicate";

export default {
    name: "이미지 검색",
    description: "이미지를 검색합니다.",
    enable: true,
    default_enable: true,
    func() {
        communicate.addHook("searchSauceNao", () => {
            const image = Array.from(document.querySelectorAll<HTMLImageElement>(":hover")).at(-1);

            if (!image || !image.src.includes("viewimage.php")) return;

            const url = new URL(image.src);

            url.host = "image.dcinside.com";
            url.pathname = "/dccon.php";

            window.open(`https://saucenao.com/search.php?url=${encodeURIComponent(url.toString())}`);
        });
    }
} as RefresherModule;