import browser from "webextension-polyfill";

export default {
    name: "디시콘 다운로드",
    description: "디시콘 다운로드 기능을 추가합니다.",
    url: /mall\.dcinside\.com/g,
    memory: {
        iframe: null,
        injected: false
    },
    enable: false,
    default_enable: false,
    require: ["filter"],
    func(filter: RefresherFilter) {
        this.memory.iframe = filter.add<HTMLIFrameElement>("#TOPTOON", (element) => {
            if (this.memory.injected) return;

            element.addEventListener("load", () => {
                const dom = element.contentDocument!;

                const button = document.createElement("button");
                button.setAttribute("type", "button");
                button.setAttribute("class", "btn_blue small");
                button.innerText = "다운로드";
                button.onclick = () => {
                    const imageList = Array.from(dom.querySelectorAll<HTMLImageElement>(".img_dccon img"));

                    browser.runtime.sendMessage(
                        JSON.stringify({
                            dcconDownload: true,
                            urls: imageList.map((image) => image.src),
                            filename: `${dom.querySelector(".viewtxt_top h4")?.textContent ?? "dccon"}.zip`
                        })
                    );
                };

                dom.body.addEventListener("click", () => {
                    const target = dom.body;

                    if (!target.classList.contains("dcon_frame")) return;

                    const observer = new MutationObserver(() => {
                        dom.querySelector(".btn_buy")?.insertAdjacentElement("beforebegin", button);
                        observer.disconnect();
                    });

                    observer.observe(dom, {
                        childList: true,
                        subtree: true
                    });
                });
            });

            this.memory.injected = true;
        });
    },
    revoke(filter: RefresherFilter) {
        if (this.memory.iframe) filter.remove(this.memory.iframe);

        this.memory.injected = false;
    }
} as RefresherModule<{
    memory: {
        iframe: string | null;
        injected: boolean;
    };
    require: ["filter"];
}>;