import ky from "ky";
import $ from "cash-dom";
import * as Toast from "../components/toast";

export default {
    name: "글쓰기 개선",
    description: "글쓰기 페이지를 개선합니다.",
    url: /gall\.dcinside\.com\/(mgallery\/|mini\/)?board\/write/,
    status: {},
    memory: {
        canvas: "",
        submitButton: ""
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
    require: ["filter"],
    func(filter: RefresherFilter) {
        this.memory.submitButton = filter.add<HTMLButtonElement>(
            "button.write",
            (element) => {
                $(element).on("click", () => {
                    if (!this.status.bypassTitleLimit) return;

                    const $titleElement = $("input#subject");
                    const title = $titleElement.val() as string;

                    if (title.length === 1) $titleElement.val(`${title}\u200B`);
                });
            }
        );

        let injected = false;

        this.memory.canvas = filter.add<HTMLIFrameElement>(
            "#tx_canvas_wysiwyg",
            (element) => {
                const win = element.contentWindow!;
                const $dom = $(win.document);

                if (injected) return;
                injected = true;

                $dom.ready(() => {
                    const contentContainer = $dom.find(".tx-content-container");

                    if (!this.status.imageUpload) return;

                    contentContainer.on("paste", async (ev) => {
                        const data = (ev as ClipboardEvent).clipboardData;

                        if (!data || !data.files.length) return;

                        ev.stopPropagation();
                        ev.preventDefault();

                        const r_key = $("#r_key").val() as string;
                        const gall_id = $("#id").val() as string;
                        const gall_no = $("#gallery_no").val() as string;
                        const _GALLTYPE_ = $("#_GALLTYPE_").val() as string;
                        const post_no = $("#no").val() as string;

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
                                const response = await ky
                                    .post(
                                        `https://upimg.dcinside.com/upimg_file.php?id=${gall_id}&r_key=${r_key}`,
                                        { body: form }
                                    )
                                    .json<any>()
                                    .then((parsed) => parsed.files[0]);

                                images.push(response);
                            } catch (e) {
                                Toast.show(String(e), true, 1000);
                            }
                        }

                        for (const image of images) {
                            const p = document.createElement("p");
                            p.style.textAlign = "left";
                            p.innerHTML = `<img style="clear:none;float:none;" src="${image.url}" class="txc-image">`;

                            contentContainer.append(p);
                        }
                    });
                });
            }
        );
    },
    revoke(filter: RefresherFilter) {
        filter.remove(this.memory.submitButton);
        filter.remove(this.memory.canvas);
    }
} as RefresherModule<{
    memory: {
        submitButton: string;
        canvas: string;
    };
    settings: {
        imageUpload: RefresherCheckSettings;
        bypassTitleLimit: RefresherCheckSettings;
        selfImage: RefresherCheckSettings;
    };
    require: ["filter"];
}>;
