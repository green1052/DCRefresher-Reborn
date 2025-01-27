import $ from "cash-dom";

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

        window.addEventListener("beforeunload", (ev) => {
            if (this.status.preventExit && !$("button:hover").eq(-1).hasClass("write")) {
                ev.preventDefault();
            }
        });

        this.memory.submitButton = filter.add<HTMLButtonElement>(
            "button.write",
            (element) => {
                $(element).on("click", () => {
                    const header = this.status.header;
                    const footer = this.status.footer;

                    const $editor = $(".note-editable");

                    if (header) {
                        $editor.prepend(header);
                    }

                    if (footer) {
                        $editor.append(footer);
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
            ".note-editable",
            (element) => {
                const $element = $(element);

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
                        $element.html(this.data!.temporarySave.content);
                    } else {
                        resetTemporaryData();
                    }

                    this.data!.temporarySave.id = gallId;

                    setInterval(() => {
                        this.data!.temporarySave.title = $("#subject").val() as string;
                        this.data!.temporarySave.content = $element.html() as string;
                        this.data!.temporarySave.date = Date.now();
                    }, 5000);
                }

                filter.remove(this.memory.canvas);
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
        bypassTitleLimit: RefresherCheckSettings;
        header: RefresherTextSettings;
        footer: RefresherTextSettings;
        temporarySave: RefresherCheckSettings;
        preventExit: RefresherCheckSettings;
    };
    require: ["filter"];
}>;
