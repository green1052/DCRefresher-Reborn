import browser from "webextension-polyfill";

export default {
    name: "디시콘 다운로드",
    description: "디시콘 다운로드 기능을 추가합니다.",
    url: /(dccon|mall)\.dcinside\.com/g,
    enable: false,
    default_enable: false,
    require: ["filter"],
    memory: {
        iframe: "",
        injected: false
    },
    func(filter: RefresherFilter) {
        this.memory.iframe = filter.add("#TOPTOON", (element) => {
            if (this.memory.injected) return;

            (element as HTMLIFrameElement).addEventListener("load", (e) => {
                const dom = (e.target as HTMLIFrameElement).contentDocument!;

                const button = document.createElement("button");
                button.setAttribute("type", "button");
                button.setAttribute("class", "btn_blue small");
                button.innerText = "다운로드";
                button.onclick = () => {
                    const imageList = [...dom.querySelectorAll(".img_dccon img")] as HTMLImageElement[];

                    browser.runtime.sendMessage(
                        JSON.stringify({
                            downloadDccon: true,
                            urlList: imageList.map((image) => image.src),
                            filename: `${dom.querySelector(".viewtxt_top h4")?.textContent ?? "dccon"}.zip`
                        })
                    );
                };

                dom.body.addEventListener("click", (ev) => {
                    const target = ev.target as HTMLElement;

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
        if (this.memory.iframe)
            filter.remove(this.memory.iframe);

        this.memory.injected = false;
    }
};