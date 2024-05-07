import $ from "cash-dom";
import {Cash} from "cash-dom/dist/cash";
import ky from "ky";
import Cookies from "js-cookie";
import {eventBus} from "../core/eventbus";

export default {
    name: "관리",
    description: "무급 노예들을 위한 여러 편의 기능을 제공합니다.",
    url: /\/board\/(view|lists)/,
    status: {},
    data: {
        ratio: {}
    },
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
        },
        checkRatio: {
            name: "글댓비 표시",
            desc: "글댓비를 표시합니다. (3일 마다 갱신, 새 글 작성시에만 조회)",
            type: "check",
            default: false
        }
    },
    require: ["filter", "eventBus"],
    func(filter, eventBus) {
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

        this.memory.always = filter.add(".ub-writer:not([user_name])", (element) => {
            if (!this.status.checkRatio || element.dataset.refresherRatio === "true") return false;

            const ratio = this.data!.ratio[element.dataset.uid!];

            if (!ratio) return false;

            const text = document.createElement("span");
            text.className = "ip refresherUserData";
            text.innerHTML = `[${ratio.article}/${ratio.comment}]`;
            text.title = `${ratio.article}/${ratio.comment}`;

            const fl = element.querySelector(".fl");

            if (fl) {
                const flIpQuery = fl.querySelector(".ip, .writer_nikcon");

                // insert After
                if (flIpQuery) fl.insertBefore(text, flIpQuery.nextSibling?.nextSibling ?? flIpQuery.nextSibling);

                // if (flIpQuery) fl.insertBefore(text, flIpQuery.nextSibling);
            } else {
                element.appendChild(text);
            }

            element.dataset.refresherRatio = "true";
        }, {
            neverExpire: true
        });

        this.memory.newPostListEvent = eventBus.on("newPostList", async (articles: Cash[]) => {
            if (!this.status.checkRatio) return;

            const getRatio = async (uid: string) => {
                const params = new URLSearchParams();
                params.set("ci_t", Cookies.get("ci_c") ?? "");
                params.set("user_id", uid);

                const response = await ky.post("/api/gallog_user_layer/gallog_content_reple/", {
                    body: params,
                    headers: {
                        "X-Requested-With": "XMLHttpRequest"
                    }
                }).text();

                const [article, comment] = response.split(",").map(Number);

                const result = {article, comment, data: Date.now()};

                const deepCopy = {...this.data!.ratio};
                deepCopy[uid] = result;

                this.data!.ratio = deepCopy;

                return result;
            };

            for (const article of articles) {
                const $writer = article.find(".ub-writer");
                const uid = $writer.attr("data-uid");

                if (!uid) continue;

                let ratio = this.data!.ratio?.[uid] ?? await getRatio(uid);

                if (Date.now() - ratio.data > 1000 * 60 * 60 * 24 * 3) {
                    ratio = await getRatio(uid);
                }

                const $ratio = $(`<span class="ip refresherUserData" title="${ratio.article}/${ratio.comment}">[${ratio.article}/${ratio.comment}]</span>`);
                $writer.append($ratio);
            }
        });
    },
    revoke(filter) {
        if (this.memory.checkBox) filter.remove(this.memory.checkBox);
        if (this.memory.newPostListEvent) eventBus.remove("newPostList", this.memory.newPostListEvent);
    }
} as RefresherModule<{
    data: {
        ratio: Record<string, { article: number; comment: number; data: number; }>
    },
    memory: {
        always: string;
        checkBox: string;
        newPostListEvent: string;
    };
    settings: {
        checkAllTargetUser: RefresherCheckSettings;
        checkViaShift: RefresherCheckSettings;
        checkCommentViaCtrl: RefresherCheckSettings;
        checkRatio: RefresherCheckSettings;
    };
    require: ["filter", "eventBus"];
}>;