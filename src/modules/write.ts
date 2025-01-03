import * as Toast from "../components/toast";
import $ from "cash-dom";
import ky from "ky";
import {blobToWebP} from "webp-converter-browser";
import {Cash} from "cash-dom/dist/cash";
import {inject} from "../utils/inject";

export default {
    name: "글쓰기",
    description: "글쓰기 페이지를 변경합니다.",
    url: /\/board\/(write|modify)/,
    status: {},
    data: {
        temporarySave: {
            id: "",
            title: "",
            content: "",
            date: 0
        }
    },
    memory: {
        canvas: "",
        submitButton: ""
    },
    enable: false,
    default_enable: false,
    settings: {
        bypassUpload: {
            name: "이미지 우회 업로드",
            desc: "이미지 업로드를 우회합니다. (활성화 시 이미지 제한을 우회할 수 있으나 아이콘이 안 보이는 등 여러 문제가 발생할 수도 있습니다.)",
            type: "check",
            default: false
        },
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
            desc: "자짤 기능을 활성화합니다. (URL)",
            type: "text",
            default: ""
        },
        header: {
            name: "머리말",
            desc: "머리말을 설정합니다. (HTML)",
            type: "text",
            default: ""
        },
        footer: {
            name: "꼬리말",
            desc: "꼬리말을 설정합니다. (HTML)",
            type: "text",
            default: ""
        },
        convertWebp: {
            name: "WebP 변환",
            desc: "이미지 업로드 기능으로 업로드시 이미지를 WebP로 변환합니다.",
            type: "check",
            default: false
        },
        convertWebpQuality: {
            name: "WebP 변환 품질",
            desc: "WebP 변환 품질을 설정합니다.",
            type: "range",
            default: 70,
            min: 1,
            max: 100,
            step: 1,
            unit: "%"
        },
        temporarySave: {
            name: "임시 저장",
            desc: "글 작성 중 내용을 임시 저장합니다.",
            type: "check",
            default: false
        },
        preventExit: {
            name: "나가기 방지",
            desc: "글 작성 중 나가기를 방지합니다.",
            type: "check",
            default: false
        }
    },
    require: ["filter"],
    func(filter) {
        const resetTemporaryData = () => {
            this.data!.temporarySave.id = "";
            this.data!.temporarySave.title = "";
            this.data!.temporarySave.content = "";
            this.data!.temporarySave.date = 0;
        };

        inject("../assets/js/editor.js");

        window.addEventListener("message", (event) => {
            if (event.source !== window || event.data?.type !== "refresherEditorLoaded") return;


        });

        window.addEventListener("beforeunload", (ev) => {
            if (this.status.preventExit && !$("button:hover").eq(-1).hasClass("write")) {
                ev.preventDefault();
            }
        });

        const attachImage = ($contentContainer: Cash, data: string | Record<string, string>) => {
            if (!this.status.bypassUpload && typeof data === "object") {
                const url = data.web__url ?? data.url;

                $("#upload_status").val("Y");

                window.postMessage({
                    type: "refresherAttachUpload",
                    data: {
                        imageurl: url,
                        filename: data.name,
                        filesize: data.size,
                        imagealign: "L",
                        originalurl: url,
                        thumburl: url,
                        file_temp_no: data.file_temp_no,
                        mp4: ""
                    }
                }, "*");

                return;
            }

            const url = typeof data === "string" ? data : data.web__url ?? data.url;

            $contentContainer.append(`<p style="text-align: left"><img style="clear: none; float: none" id="tx_entry_${Math.floor(Math.random() * 90000) + 10000}_" src="${url}" class=txc-image></p>`);
        };

        this.memory.submitButton = filter.add<HTMLButtonElement>(
            "button.write",
            (element) => {
                $(element).on("click", () => {
                    const header = this.status.header;
                    const footer = this.status.footer;
                    const selfImage = this.status.selfImage;

                    const $canvas = $("#tx_canvas_wysiwyg").contents().find("body");
                    const canvas = $canvas.get(0) as HTMLBodyElement;

                    const selectTop = () => {
                        if (!canvas) return;

                        canvas.focus();
                        // @ts-ignore
                        canvas.setSelectionRange(0, 0);
                    };

                    if (selfImage) {
                        selectTop();
                        attachImage($canvas, selfImage);
                    }

                    if (header) {
                        selectTop();
                        $canvas
                            .prepend(`${header}`);
                    }

                    if (footer) {
                        $canvas.append(`${footer}`);
                    }

                    if (this.status.bypassTitleLimit) {
                        const $titleElement = $("input#subject");
                        const title = $titleElement.val() as string;

                        if (title.length === 1) $titleElement.val(`${title}\u200B`);
                    }

                    resetTemporaryData();
                });

                filter.remove(this.memory.submitButton);
            }
        );

        this.memory.canvas = filter.add<HTMLIFrameElement>(
            "#tx_canvas_wysiwyg",
            (element) => {
                window.addEventListener("message", (event) => {
                    if (event.source !== window || event.data?.type !== "refresherEditorLoaded") return;

                    const $dom = $(element.contentDocument);
                    const $contentContainer = $dom.find("body");

                    if (this.status.imageUpload) {
                        $contentContainer.on("paste", async (ev: ClipboardEvent) => {
                            const data = ev.clipboardData;

                            if (!data || !data.files.length) return;

                            ev.stopPropagation();
                            ev.preventDefault();

                            Toast.show("이미지 업로드 중...", false, 1000);

                            const r_key = $("#r_key").val() as string;
                            const gall_id = $("#id").val() as string;
                            const gall_no = $("#gallery_no").val() as string;
                            const _GALLTYPE_ = $("#_GALLTYPE_").val() as string;
                            const post_no = $("#no").val() as string;

                            const form = new FormData();
                            form.append("r_key", r_key);
                            form.append("gall_id", gall_id);
                            form.append("gall_no", gall_no);
                            form.append("post_no", post_no || "");
                            form.append("upload_ing", "N");
                            form.append("_GALLTYPE_", _GALLTYPE_);

                            const images = [];

                            for (const file of data.files) {
                                if (!file.type.startsWith("image/")) continue;

                                const image = this.status.convertWebp
                                    ? await blobToWebP(file, {
                                        quality: this.status.convertWebpQuality / 100
                                    })
                                    : file;

                                form.set(
                                    "files[]",
                                    new File(
                                        [image],
                                        `${new Date().getTime()}.${file.name.split(".").at(-1)}`,
                                        {
                                            type: image.type
                                        }
                                    )
                                );

                                try {
                                    const response = await ky.post("https://upimg.dcinside.com/upimg_file.php", {
                                        searchParams: {
                                            id: gall_id,
                                            r_key
                                        },
                                        body: form,
                                        timeout: 30000
                                    }).json<any>();

                                    images.push(response.files[0]);
                                } catch (e) {
                                    Toast.show(String(e), true, 5000);
                                    return;
                                }
                            }

                            for (const image of images) {
                                attachImage($contentContainer, image);
                            }

                            Toast.show("이미지 업로드 완료", false, 1000);
                        });
                    }

                    if (this.status.temporarySave) {
                        const gallId = $("form > input[name=id]").val() as string;

                        if (Date.now() - this.data!.temporarySave.date > 86400000) {
                            resetTemporaryData();
                        }

                        if (
                            this.data!.temporarySave.id === gallId &&
                            this.data!.temporarySave.title &&
                            this.data!.temporarySave.content &&
                            this.data!.temporarySave.date &&
                            confirm("이전에 작성한 글이 있습니다. 불러오시겠습니까? (취소 시 삭제)")
                        ) {
                            $("#subject").val(this.data!.temporarySave.title);
                            $contentContainer.html(this.data!.temporarySave.content);
                        } else {
                            resetTemporaryData();
                        }

                        this.data!.temporarySave.id = gallId;

                        setInterval(() => {
                            this.data!.temporarySave.title = $("#subject").val() as string;
                            this.data!.temporarySave.content = $contentContainer.html() as string;
                            this.data!.temporarySave.date = Date.now();
                        }, 5000);
                    }

                    filter.remove(this.memory.canvas);
                });
            });
    },
    revoke(filter) {
        filter.remove(this.memory.submitButton);
        filter.remove(this.memory.canvas);
    }
} as RefresherModule<{
    data: {
        temporarySave: {
            id: string;
            title: string;
            content: string;
            date: number;
        }
    },
    memory: {
        submitButton: string;
        canvas: string;
    };
    settings: {
        bypassUpload: RefresherCheckSettings;
        imageUpload: RefresherCheckSettings;
        bypassTitleLimit: RefresherCheckSettings;
        selfImage: RefresherTextSettings;
        header: RefresherTextSettings;
        footer: RefresherTextSettings;
        convertWebp: RefresherCheckSettings;
        convertWebpQuality: RefresherRangeSettings;
        temporarySave: RefresherCheckSettings;
        preventExit: RefresherCheckSettings;
    };
    require: ["filter"];
}>;
