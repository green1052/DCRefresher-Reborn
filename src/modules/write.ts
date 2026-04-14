import $ from "cash-dom";

import filter from "../core/filtering";

export default {
    name: "글쓰기",
    description: "글쓰기 페이지를 변경합니다.",
    url: /\/board\/(write|modify)/,
    status: {},
    memory: {
        submitButton: "",
        beforeUnloadHandler: null as ((ev: BeforeUnloadEvent) => void) | null
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
        preventExit: {
            name: "나가기 방지",
            desc: "글 작성 중 나가기를 방지합니다.",
            type: "check",
            default: false
        }
    },
    func() {
        this.memory.beforeUnloadHandler = (ev: BeforeUnloadEvent) => {
            if (this.status.preventExit && !$("button:hover").eq(-1).hasClass("write")) {
                ev.preventDefault();
            }
        };
        window.addEventListener("beforeunload", this.memory.beforeUnloadHandler);

        this.memory.submitButton = filter.add<HTMLButtonElement>("button.write", (element) => {
            $(element).on("click", () => {
                const $editor = $(".note-editable");

                if (this.status.header) {
                    $editor.prepend(this.status.header);
                }

                if (this.status.footer) {
                    $editor.append(this.status.footer);
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
    revoke() {
        filter.remove(this.memory.submitButton);
        if (this.memory.beforeUnloadHandler) {
            window.removeEventListener("beforeunload", this.memory.beforeUnloadHandler);
            this.memory.beforeUnloadHandler = null;
        }
    }
} as RefresherModule<{
    memory: {
        submitButton: string;
        beforeUnloadHandler: ((ev: BeforeUnloadEvent) => void) | null;
    };
    settings: {
        bypassTitleLimit: RefresherCheckSettings;
        header: RefresherTextSettings;
        footer: RefresherTextSettings;
        preventExit: RefresherCheckSettings;
    };
}>;