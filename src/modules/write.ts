export default {
    name: "글쓰기 개선",
    description: "글쓰기 페이지를 개선합니다.",
    url: /gall\.dcinside\.com\/(mgallery\/|mini\/)?board\/write/,
    status: {},
    memory: {
        canvas: "",
        injected: false,
        injected2: false
    },
    enable: false,
    default_enable: false,
    settings: {
        imageUpload: {
            name: "이미지 업로드",
            desc: "붙여넣기로 이미지를 업로드할 수 있습니다.",
            type: "check",
            default: false
        },
        bypassTitleLimit: {
            name: "제목 글자수 제한 우회",
            desc: "제목 글자수 제한을 우회합니다.",
            type: "check",
            default: false
        },
        selfImage: {
            name: "자짤 기능 활성화",
            desc: "자짤 기능을 활성화합니다.",
            type: "check",
            default: false
        }
    },
    require: ["filter", "http"],
    func(filter: RefresherFilter, http: RefresherHTTP) {
        this.memory.submitButton = filter.add<HTMLButtonElement>(
            "button.write",
            (element) => {
                if (this.memory.injected || !this.status.bypassTitleLimit)
                    return;

                element.addEventListener("click", () => {
                    const titleElement =
                        document.querySelector<HTMLInputElement>(
                            "input[id=subject]"
                        );

                    if (!titleElement) return;

                    const title = titleElement.value;

                    if (title.length === 1)
                        titleElement.value = `${title}\u200B`;
                });

                this.memory.injected = true;
            }
        );

        this.memory.canvas = filter.add<HTMLIFrameElement>(
            "#tx_canvas_wysiwyg",
            (element) => {
                if (this.memory.injected2) return;

                const iframe = element.contentWindow!.document!;
                const contentContainer = iframe?.querySelector<HTMLElement>(
                    ".tx-content-container"
                );

                if (this.status.imageUpload) {
                    contentContainer?.addEventListener("paste", async (ev) => {
                        const data = (ev as ClipboardEvent).clipboardData;

                        if (!data || !data.files.length) return;

                        ev.stopPropagation();
                        ev.preventDefault();

                        const r_key =
                            document.querySelector<HTMLInputElement>(
                                "#r_key"
                            )!.value;
                        const gall_id =
                            document.querySelector<HTMLInputElement>(
                                "#id"
                            )!.value;
                        const gall_no =
                            document.querySelector<HTMLInputElement>(
                                "#gallery_no"
                            )!.value;
                        const _GALLTYPE_ =
                            document.querySelector<HTMLInputElement>(
                                "#_GALLTYPE_"
                            )!.value;
                        const post_no =
                            document.querySelector<HTMLInputElement>("#no")
                                ?.value ?? "";

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

                            form.set(
                                "files",
                                new File(
                                    [file],
                                    `${new Date().getTime()}-${file.name}`,
                                    {
                                        type: file.type
                                    }
                                )
                            );

                            try {
                                const response = await http
                                    .make(
                                        `https://upimg.dcinside.com/upimg_file.php?id=${gall_id}&r_key=${r_key}`,
                                        {
                                            method: "POST",
                                            cache: "no-store",
                                            referrer: location.href,
                                            body: form
                                        }
                                    )
                                    .then(JSON.parse)
                                    .then((parsed) => parsed.files[0]);

                                images.push(response);
                            } catch {}
                        }

                        for (const image of images) {
                            const p = document.createElement("p");
                            p.style.textAlign = "left";
                            p.innerHTML = `<img style="clear:none;float:none;" src="${image.url}" class="txc-image">`;

                            contentContainer.appendChild(p);

                            // contentContainer.insertBefore(
                            //     p,
                            //     iframe.getSelection()!.anchorNode!.parentElement
                            // );
                        }
                    });
                }

                this.memory.injected2 = true;
            }
        );
    },
    revoke(filter: RefresherFilter) {
        if (this.memory.submitButton) filter.remove(this.memory.submitButton);

        if (this.memory.canvas) filter.remove(this.memory.canvas);

        this.memory.injected = false;
        this.memory.injected2 = false;
    }
} as RefresherModule<{
    memory: {
        submitButton: string;
        canvas: string;
        injected: boolean;
        injected2: boolean;
    };
    settings: {
        imageUpload: RefresherCheckSettings;
        bypassTitleLimit: RefresherCheckSettings;
        selfImage: RefresherCheckSettings;
    };
    require: ["filter", "http"];
}>;
