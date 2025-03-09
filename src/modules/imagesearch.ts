import * as communicate from "../core/communicate";
import $ from "cash-dom";

export default {
    name: "이미지 검색",
    description: "이미지를 검색합니다. (Firefox에서 작동 안함)",
    enable: true,
    default_enable: true,
    func() {
        communicate.addHook("searchSauceNao", () => {
            const image = $("img:hover").eq(-1);
            const src = image.attr("src");

            if (!image.length || !src || !src.includes("viewimage.php")) return;

            const url = new URL(src);
            url.host = "image.dcinside.com";
            url.pathname = "/dccon.php";

            window.open(
                `https://saucenao.com/search.php?url=${encodeURIComponent(url.toString())}`
            );
        });
    }
} as RefresherModule;
