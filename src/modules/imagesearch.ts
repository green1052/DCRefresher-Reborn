import $ from "cash-dom";
import communicate from "../core/communicate";

export default {
    name: "이미지 검색",
    description: "이미지를 검색합니다.",
    memory: {
        sauceNao: "",
        currentImage: null
    },
    enable: true,
    default_enable: true,
    func() {
        window.addEventListener("contextmenu", (ev) => {
            const $element = $(ev.target as HTMLElement);

            if ($element.is("img")) this.memory.currentImage = $element.attr("src");
        });

        const foo = (targetUrl: string) => {
            if (!this.memory.currentImage?.includes("viewimage.php")) return;

            const url = new URL(this.memory.currentImage);
            url.host = "image.dcinside.com";
            url.pathname = "/dccon.php";

            window.open(targetUrl.replace("[url]", encodeURIComponent(url.toString())));
        };

        this.memory.sauceNao = communicate.addHook("searchSauceNao", () => foo("https://saucenao.com/search.php?url=[url]"));
    },
    revoke() {
        communicate.clearHook("searchSauceNao", this.memory.sauceNao);
    }
} as RefresherModule<{
    memory: {
        sauceNao: string;
        currentImage: string | null;
    };
}>;