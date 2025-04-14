import $ from "cash-dom";

export default {
    name: "글쓰기",
    description: "글쓰기 페이지를 변경합니다.",
    url: /\/board\/(write|modify)/,
    status: {},
    memory: {
        submitButton: ""
    },
    enable: false,
    default_enable: false,
    settings: {
        bypassTitleLimit: {
            name: "제목 글자수 제한 우회",
            desc: "제목 글자수 제한을 우회합니다.",
            type: "check",
            default: false
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
        selfImage: {
            name: "자짤",
            desc: "자짤을 설정합니다. (이미지 주소)",
            type: "text",
            default: ""
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
        window.addEventListener("beforeunload", (ev) => {
            if (this.status.preventExit && !$("button:hover").eq(-1).hasClass("write")) {
                ev.preventDefault();
            }
        });

        this.memory.submitButton = filter.add<HTMLButtonElement>("button.write", (element) => {
            $(element).on("click", () => {
                const $editor = $(".note-editable");

                if (this.status.header) {
                    $editor.prepend(this.status.header);
                }

                if (this.status.footer) {
                    $editor.append(this.status.footer);
                }

                if (this.status.selfImage) {
                    $editor.prepend(`<p><img src="${this.status.selfImage}"></p><p><br></p>`);
                }

                if (this.status.bypassTitleLimit) {
                    const $titleElement = $("input#subject");
                    const title = $titleElement.val() as string;

                    if (title.length === 1) $titleElement.val(`${title}\u200B`);
                }
            });

            filter.remove(this.memory.submitButton);
        });
    },
    revoke(filter) {
        filter.remove(this.memory.submitButton);
    }
} as RefresherModule<{
    memory: {
        submitButton: string;
    };
    settings: {
        bypassTitleLimit: RefresherCheckSettings;
        header: RefresherTextSettings;
        footer: RefresherTextSettings;
        selfImage: RefresherTextSettings;
        preventExit: RefresherCheckSettings;
    };
    require: ["filter"];
}>;
