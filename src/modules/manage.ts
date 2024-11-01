import $ from "cash-dom";
import {Cash} from "cash-dom/dist/cash";
import ky from "ky";
import Cookies from "js-cookie";
import {eventBus} from "../core/eventbus";
import * as http from "../utils/http";
import * as storage from "../utils/storage";

let permBanList: Record<string, string[]> | null = null;

storage.get<Record<string, string[]>>("refresher.database.ban").then((value) => {
    permBanList = value;
});

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
        },
        deleteViaCtrl: {
            name: "Ctrl로 삭제",
            desc: "Ctrl키를 누른 상태로 게시글을 클릭해 삭제합니다.",
            type: "check",
            default: false
        },
        checkPermBan: {
            name: "갱차 조회",
            desc: "갱신 차단 여부를 조회합니다.",
            type: "check",
            default: false
        }
    },
    require: ["filter", "eventBus"],
    func(filter, eventBus) {
        const deletePost = async (id: string) => {
            if (!id) return;

            const galleryType = http.galleryType(location.href, "/");

            const params = new URLSearchParams();
            params.set("ci_t", Cookies.get("ci_c") ?? "");
            params.set("id", $("#gallery_id").val() as string);
            params.set("nos[]", id);
            params.set("_GALLTYPE_", http.galleryTypeName(location.href));

            await ky.post(
                galleryType === "mini/"
                    ? http.urls.manage.deleteMini
                    : http.urls.manage.delete,
                {
                    headers: {
                        "X-Requested-With": "XMLHttpRequest"
                    },
                    body: params
                }
            );
        };

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

        this.memory.content = filter.add(".gall_list .ub-content", (element) => {
            if (!this.status.deleteViaCtrl) return;

            element.onclick ??= (ev: MouseEvent) => {
                if (!this.status.deleteViaCtrl || !ev.ctrlKey) return;

                ev.preventDefault();
                ev.stopPropagation();

                deletePost(element.dataset.no!);
            };
        }, {neverExpire: true});

        this.memory.always = filter.add(".ub-writer:not([user_name])", (element) => {
            if (this.status.checkPermBan && element.dataset.refresherPermBan !== "true") {
                const permBan = getPermBan(element.dataset.uid!);

                if (permBan) {
                    element.dataset.refresherPermBan = "true";

                    const text = document.createElement("span");
                    text.style.color = "red";
                    text.className = "ip ratio refresherUserData";
                    text.innerHTML = `[${permBan}]`;
                    text.title = permBan;

                    const fl = element.querySelector(".fl");

                    if (fl) {
                        const flIpQuery = fl.querySelector(".ip, .writer_nikcon");
                        if (flIpQuery) fl.insertBefore(text, flIpQuery.nextSibling?.nextSibling ?? flIpQuery.nextSibling);
                    } else {
                        element.appendChild(text);
                    }
                }
            }

            if (this.status.checkRatio && element.dataset.refresherRatio !== "true") {
                if (!this.data!.ratio.hasOwnProperty(element.dataset.uid!)) return false;

                const ratio = this.data!.ratio[element.dataset.uid!];

                if (!ratio) return false;

                element.dataset.refresherRatio = "true";

                const text = document.createElement("span");
                text.className = "ip ratio refresherUserData";
                text.innerHTML = `[${ratio.article}/${ratio.comment}]`;
                text.title = `${ratio.article}/${ratio.comment}`;

                const fl = element.querySelector(".fl");

                if (fl) {
                    const flIpQuery = fl.querySelector(".ip, .writer_nikcon");
                    if (flIpQuery) fl.insertBefore(text, flIpQuery.nextSibling?.nextSibling ?? flIpQuery.nextSibling);
                } else {
                    element.appendChild(text);
                }
            }
        }, {
            neverExpire: true
        });

        const getPermBan = (uid: string): string | undefined => {
            if (!permBanList) return;

            const list = [];

            for (const [key, value] of Object.entries(permBanList)) {
                if (value.includes(uid)) list.push(key);
            }

            return list.join(", ");
        };

        const getRatio = async (uid: string) => {
            const params = new URLSearchParams();
            params.set("ci_t", Cookies.get("ci_c") ?? "");
            params.set("user_id", uid);

            const response = await ky.post("https://gall.dcinside.com/api/gallog_user_layer/gallog_content_reple", {
                body: params,
                headers: {
                    "X-Requested-With": "XMLHttpRequest"
                }
            }).text();

            const [article, comment] = response.split(",").map(Number);

            const result = {article, comment, date: Date.now()};

            const deepCopy = {...this.data!.ratio};
            deepCopy[uid] = result;

            this.data!.ratio = deepCopy;

            return result;
        };

        this.memory.newPostListEvent = eventBus.on("newPostList", async (articles: Cash[]) => {
            for (const $article of articles) {
                const $writer = $article.find(".ub-writer");
                const uid = $writer.data("uid");

                if (!uid) continue;

                if (this.status.checkPermBan) {
                    const permBan = getPermBan(uid);

                    if (permBan) {
                        const $permBan = $(`<span style="color: red" class="ip permBan refresherUserData" title="${permBan}">[${permBan}]</span>`);

                        if ($article.data("refresherPermBan") === true) {
                            $article.find(".permBan").replaceWith($permBan);
                        } else {
                            $article.data("refresherPermBan", true);
                            $writer.add($permBan);
                        }
                    }
                }

                if (!this.status.checkRatio) continue;

                let ratio = this.data!.ratio?.[uid];

                if (!ratio || (ratio && Date.now() - ratio.date > 1000 * 60 * 60 * 24 * 3)) {
                    ratio = await getRatio(uid);
                }

                const $ratio = $(`<span class="ip ratio refresherUserData" title="${ratio.article}/${ratio.comment}">[${ratio.article}/${ratio.comment}]</span>`);

                if ($article.data("refresherRatio") === true) {
                    $article.find(".ratio").replaceWith($ratio);
                    continue;
                }

                $article.data("refresherRatio", true);
                $writer.append($ratio);
            }
        });
    },
    revoke(filter) {
        if (this.memory.checkBox) filter.remove(this.memory.checkBox);
        if (this.memory.newPostListEvent) eventBus.remove("newPostList", this.memory.newPostListEvent);
        if (this.memory.content) filter.remove(this.memory.content);
    }
} as RefresherModule<{
    data: {
        ratio: Record<string, { article: number; comment: number; date: number; }>
    },
    memory: {
        always: string;
        checkBox: string;
        newPostListEvent: string;
        content: string;
    };
    settings: {
        checkAllTargetUser: RefresherCheckSettings;
        checkViaShift: RefresherCheckSettings;
        checkCommentViaCtrl: RefresherCheckSettings;
        checkRatio: RefresherCheckSettings;
        deleteViaCtrl: RefresherCheckSettings;
        checkPermBan: RefresherCheckSettings;
    };
    require: ["filter", "eventBus"];
}>;