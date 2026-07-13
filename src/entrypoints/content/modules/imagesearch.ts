import {onMessage} from "@/http/messaging";

export default {
    name: "이미지 검색",
    description: "이미지를 검색합니다.",
    memory: {
        sauceNao: null as (() => void) | null,
        currentImage: null,
        contextMenuHandler: null
    },
    enable: true,
    default_enable: true,
    func() {
        this.memory.contextMenuHandler = (ev: MouseEvent) => {
            if (!(ev.target instanceof HTMLImageElement)) return;
            this.memory.currentImage = ev.target.src;
        };
        window.addEventListener("contextmenu", this.memory.contextMenuHandler);

        const foo = (targetUrl: string) => {
            if (!this.memory.currentImage?.includes("viewimage.php")) return;

            const url = new URL(this.memory.currentImage);
            url.host = "image.dcinside.com";
            url.pathname = "/dccon.php";

            window.open(targetUrl.replace("[url]", encodeURIComponent(url.toString())));
        };

        this.memory.sauceNao = onMessage("searchSauceNao", () => foo("https://saucenao.com/search.php?url=[url]"));
    },
    revoke() {
        if (this.memory.contextMenuHandler) {
            window.removeEventListener("contextmenu", this.memory.contextMenuHandler);
        }
        if (this.memory.sauceNao) this.memory.sauceNao();
    }
} as RefresherModule<{
    memory: {
        sauceNao: (() => void) | null;
        currentImage: string | null;
        contextMenuHandler: ((ev: MouseEvent) => void) | null;
    };
}>;