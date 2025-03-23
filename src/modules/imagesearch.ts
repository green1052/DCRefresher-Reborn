import $ from "cash-dom";

import communicate from "../core/communicate";

export default {
    name: "이미지 검색",
    description: "이미지를 검색합니다.",
    memory: {
        id: "",
        currentImage: ""
    },
    enable: true,
    default_enable: true,
    func() {
        window.addEventListener("contextmenu", (ev) => {
            const $element = $(ev.target);

            if ($element.is("img")) this.memory.currentImage = $element.attr("src");
        });

        this.memory.id = communicate.addHook("searchSauceNao", () => {
            if (!this.memory.currentImage.includes("viewimage.php")) return;

            const url = new URL(this.memory.currentImage);
            url.host = "image.dcinside.com";
            url.pathname = "/dccon.php";

            window.open(`https://saucenao.com/search.php?url=${encodeURIComponent(url.toString())}`);
        });
    },
    revoke() {
        communicate.clearHook("searchSauceNao", this.memory.id);
    }
} as RefresherModule<{
    memory: {
        id: string;
        currentImage: string;
    };
}>;
