export default {
    name: "글쓰기 개선",
    description: "글쓰기 페이지를 개선합니다.",
    url: /gall\.dcinside\.com\/(mgallery\/|mini\/)?board\/write/,
    require: ["filter", "http"],
    memory: {
        canvas: "",
        injected: false
    },
    status: {
        imageUpload: false,
        selfImage: false
    },
    settings: {
        imageUpload: {
            name: "이미지 업로드",
            desc: "붙여넣기로 이미지를 업로드할 수 있습니다.",
            type: "check",
            default: false
        }
    },
    enable: false,
    default_enable: false,
    func(filter: RefresherFilter, http: RefresherHTTP) {
        if (!this.status.imageUpload) return;

        this.memory.canvas = filter.add("#tx_canvas_wysiwyg", (element) => {
            if (this.memory.injected) return;

            const iframe = (element as HTMLIFrameElement).contentWindow!.document!;
            const contentContainer = iframe?.querySelector(".tx-content-container") as HTMLElement;

            if (this.status.imageUpload) {
                contentContainer?.addEventListener("paste", async (ev) => {
                    const data = (ev as ClipboardEvent).clipboardData;

                    if (data === null || data.files.length === 0) return;

                    ev.stopPropagation();
                    ev.preventDefault();

                    const r_key = (document.querySelector("#r_key") as HTMLInputElement).value;
                    const gall_id = (document.querySelector("#id") as HTMLInputElement).value;
                    const gall_no = (document.querySelector("#gallery_no") as HTMLInputElement).value;
                    const _GALLTYPE_ = (document.querySelector("#_GALLTYPE_") as HTMLInputElement).value;
                    const post_no = (document.querySelector("#no") as HTMLInputElement).value ?? "";

                    const form = new FormData();
                    form.append("r_key", r_key);
                    form.append("gall_id", gall_id);
                    form.append("gall_no", gall_no);
                    form.append("post_no", post_no);
                    form.append("upload_ing", "N");
                    form.append("_GALLTYPE_", _GALLTYPE_);

                    const images = [];

                    for (const file of data.files) {
                        if (!file.type.startsWith("image/")) continue;

                        form.set("files", new File([file], `${new Date().getTime()}-${file.name}`, {type: file.type}));

                        try {
                            const response = JSON.parse(await http.make(`https://upimg.dcinside.com/upimg_file.php?id=${gall_id}&r_key=${r_key}`, {
                                method: "POST",
                                cache: "no-store",
                                referrer: location.href,
                                body: form
                            })).files[0];

                            images.push(response);
                        } catch {
                        }
                    }

                    for (const image of images) {
                        const p = document.createElement("p");
                        p.style.textAlign = "left";
                        p.innerHTML = `<img style="clear:none;float:none;" src="${image.url}" class="txc-image">`;

                        contentContainer.insertBefore(p, iframe.getSelection()!.anchorNode!.parentElement);
                    }
                });
            }

            this.memory.injected = true;
        });
    },
    revoke(filter: RefresherFilter) {
        if (this.memory.canvas)
            filter.remove(this.memory.canvas);

        this.memory.injected = false;
    }
};