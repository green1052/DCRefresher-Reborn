import $ from "cash-dom";
import communicate from "../core/communicate";

export default {
    name: "이미지 검색",
    description: "이미지를 검색합니다.",
    memory: {
        sauceNao: "",
        iqdb: "",
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
        this.memory.iqdb = communicate.addHook("searchIqdb", () => foo("https://iqdb.org/?url=[url]"));
    },
    revoke() {
        communicate.clearHook("searchSauceNao", this.memory.sauceNao);
        communicate.clearHook("searchIqdb", this.memory.iqdb);
    }
} as RefresherModule<{
    memory: {
        sauceNao: string;
        iqdb: string;
        currentImage: string | null;
    };
}>;