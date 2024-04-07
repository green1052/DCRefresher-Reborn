import $ from "cash-dom";

export default {
    name: "관리",
    description: "무급 노예들을 위한 여러 편의 기능을 제공합니다.",
    url: /\/board\/(view|lists)/,
    status: {},
    memory: {},
    enable: false,
    default_enable: false,
    settings: {
        checkAllTargetUser: {
            name: "선택한 유저 전부 체크",
            desc: "Shift키를 누른 상태로 체크박스를 눌러 대상 유저 전부를 체크합니다. (아이디, IP, 이름 순서)",
            type: "check",
            default: false
        },
        checkViaShift: {
            name: "Shift 다중 체크",
            desc: "Shift키를 누른 상태로 드래그해 여러 항목을 체크합니다.",
            type: "check",
            default: false
        },
        checkCommentViaCtrl: {
            name: "Ctrl 대댓글 체크",
            desc: "Ctrl키를 누른 상태로 댓글을 클릭하면 대댓글도 체크합니다.",
            type: "check",
            default: false
        }
    },
    require: ["filter"],
    func(filter) {
        this.memory.checkBox = filter.add<HTMLInputElement>(".article_chkbox", (element) => {
            if (this.status.checkAllTargetUser) {
                const $element = $(element);
                const $writer = $element.closest(".ub-content, .cmt_nickbox").children(".ub-writer");

                const uid = $writer.attr("data-uid");
                const ip = $writer.attr("data-ip");
                const nick = $writer.attr("data-nick");

                let type: "data-uid" | "data-ip" | "data-nick" | null = null;
                let target: string | null = null;

                if (uid) {
                    type = "data-uid";
                    target = uid;
                } else if (ip) {
                    type = "data-ip";
                    target = ip;
                } else if (nick) {
                    type = "data-nick";
                    target = nick;
                }

                $element.on("click", (ev: PointerEvent) => {
                    if (type && target && this.status.checkAllTargetUser && ev.shiftKey) {
                        for (const post of $(`.ub-writer[${type}="${target}"]`)) {
                            $(post)
                                .parent()
                                .find(".article_chkbox")
                                .prop("checked", (ev.target as HTMLInputElement).checked);
                        }
                    }

                    const li = $element.closest("li");
                    if (this.status.checkCommentViaCtrl && ev.ctrlKey && !li.attr("id")?.startsWith("reply_")) {
                        for (const input of li.next().find(".article_chkbox")) {
                            (input as HTMLInputElement).checked = (ev.target as HTMLInputElement).checked;
                        }
                    }
                });
            }

            if (this.status.checkViaShift) {
                $(element).on("mouseover", (ev: MouseEvent) => {
                    if (!this.status.checkViaShift || !ev.shiftKey) return;
                    $(element).prop("checked", !(ev.target as HTMLInputElement).checked);
                });
            }
        });
    },
    revoke(filter) {
        filter.remove(this.memory.checkBox);
    }
} as RefresherModule<{
    memory: {
        checkBox: string;
    };
    settings: {
        checkAllTargetUser: RefresherCheckSettings;
        checkViaShift: RefresherCheckSettings;
        checkCommentViaCtrl: RefresherCheckSettings;
    };
    require: ["filter"];
}>;