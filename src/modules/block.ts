import * as Toast from "../components/toast";
import {queryString} from "../utils/http";
import $ from "cash-dom";
import Cookies from "js-cookie";
import ky from "ky";
import {Cash} from "cash-dom/dist/cash";

function hideElement($element: Cash, blur: boolean = false) {
    if (blur) {
        $element.addClass("refresherBlur");
        return;
    }

    $element.css("display", "none");
}

export default {
    name: "컨텐츠 차단",
    description: "유저, 컨텐츠 등의 보고 싶지 않은 컨텐츠들을 삭제합니다.",
    url: /\/board\/(view|lists)/,
    status: {},
    memory: {
        uuid: null,
        uuid2: null,
        selected: {
            nick: null,
            uid: null,
            ip: null,
            code: null,
            packageIdx: null
        },
        lastSelect: 0,
        addBlock: null,
        requestBlock: null
    },
    enable: true,
    default_enable: true,
    settings: {
        replyRemove: {
            name: "대댓글 삭제",
            desc: "차단된 댓글의 대댓글을 함께 삭제합니다.",
            type: "check",
            default: false
        },
        blur: {
            name: "블러 처리",
            desc: "차단된 내용을 블러 처리합니다.",
            type: "check",
            default: false
        }
    },
    require: ["filter", "eventBus", "block", "http"],
    func(
        filter,
        eventBus,
        block,
        http
    ) {
        this.memory.uuid = filter.add(
            ".ub-writer",
            (element) => {
                const $element = $(element);

                const gallery = queryString("id");

                if (!gallery) return;

                const title = $element
                    .parent()
                    .find(".gall_tit > a:not([class])")
                    .text();

                const tab = $element
                    .parent()
                    .find(".gall_subject")
                    .text();

                const text = $element
                    .closest(".view_content_wrap")
                    .find(".write_div")
                    .text();

                const nick = element.dataset.nick ?? null;
                const uid = element.dataset.uid ?? null;
                const ip = element.dataset.ip ?? null;

                const $commentElement = $element.closest(
                    ".reply_info, .cmt_info"
                );
                const commentContent = $commentElement.find(".usertxt").text();

                if (
                    block.checkAll(
                        {
                            TITLE: title,
                            NICK: nick,
                            ID: uid,
                            IP: ip,
                            COMMENT: commentContent,
                            TAB: tab
                        },
                        gallery
                    )
                ) {
                    const $post = $element.parent();

                    if ($post.hasClass("ub-content")) {
                        hideElement($post, this.status.blur);
                        return;
                    }

                    const $content = $post.closest(".ub-content");

                    if ($content) {
                        if (this.status.replyRemove) {
                            const $next = $content.next();

                            if (!$next.hasClass("ub-content") && $next.children(".reply").length > 0) {
                                hideElement($next, this.status.blur);
                            }
                        }

                        hideElement($content, this.status.blur);
                    }

                    // if (post.parentElement?.className.startsWith("reply_")) {
                    //     element.closest<HTMLElement>(".reply")!.style.display =
                    //         "none";
                    //     return;
                    // }
                } else if (block.check("TEXT", text, gallery)) {
                    $element
                        .closest(".view_content_wrap")
                        .find(".write_div")
                        .text("게시글 내용이 차단됐습니다.");
                }

                element.oncontextmenu ??= () => {
                    this.memory.selected = {
                        nick,
                        uid,
                        ip,
                        code: null,
                        packageIdx: null
                    };
                    this.memory.lastSelect = Date.now();
                };
            },
            {
                neverExpire: true
            }
        );

        this.memory.uuid2 = filter.add(
            ".written_dccon",
            (element) => {
                const $element = $(element);

                const gallery = queryString("id");

                if (!gallery) return;

                const dccon =
                    ($element.attr("src") ?? $element.attr("data-src"))
                        ?.replace(/^.*no=/g, "")
                        .replace(/^&.*$/g, "") ?? "";

                if (block.check("DCCON", dccon, gallery)) {
                    const $comment = $element.closest(".ub-content") ?? $element.closest(".comment_dccon");

                    if (this.status.replyRemove) {
                        const $next = $comment.next();

                        if (!$next.hasClass("ub-content") && $next.children(".reply").length > 0) {
                            hideElement($next, this.status.blur);
                        }
                    }

                    hideElement($comment, this.status.blur);
                }

                element.parentElement!.oncontextmenu ??= () => {
                    const code =
                        (
                            element?.getAttribute("src") ||
                            element?.getAttribute("data-src")
                        )
                            ?.replace(/^.*no=/g, "")
                            .replace(/^&.*$/g, "") ?? "";

                    this.memory.selected = {
                        nick: null,
                        uid: null,
                        ip: null,
                        code,
                        packageIdx: null
                    };
                    this.memory.lastSelect = Date.now();
                };
            },
            {
                neverExpire: true
            }
        );

        this.memory.addBlock = eventBus.on(
            "refresherUserContextMenu",
            (
                nick: string | null,
                uid: string | null,
                ip: string | null,
                code: string | null,
                packageIdx: string | null
            ) => {
                this.memory.selected = {
                    nick,
                    uid,
                    ip,
                    code,
                    packageIdx
                };
                this.memory.lastSelect = Date.now();
            }
        );

        this.memory.requestBlock = eventBus.on(
            "refresherRequestBlock",
            (args?: Record<string, boolean>) => {
                if (Date.now() - this.memory.lastSelect > 10000) {
                    return;
                }

                const code = this.memory.selected.code;

                if (code) {
                    const params = new URLSearchParams();
                    params.set("ci_t", Cookies.get("ci_c") ?? "");
                    params.set("code", code);

                    ky.post(http.urls.dccon.detail, {
                        headers: {
                            "X-Requested-With": "XMLHttpRequest"
                        },
                        body: params
                    })
                        .json<any>()
                        .then((json) => {
                            const title = json.info.title;
                            const packageIdx = json.info.package_idx;

                            if (args?.blockAllDccon) {
                                const blockBundle = confirm("디시콘을 묶어서 차단하시겠습니까? (차단탭에서 한개로 표시됩니다.)");

                                const list = [];

                                for (const {path} of json.detail) {
                                    if (blockBundle) {
                                        list.push(path);
                                        continue;
                                    }

                                    block.add(
                                        "DCCON",
                                        path,
                                        false,
                                        false,
                                        undefined,
                                        `${title} [${packageIdx}]`
                                    );
                                }

                                if (blockBundle) {
                                    block.add(
                                        "DCCON",
                                        `^(${list.join("|")})$`,
                                        true,
                                        false,
                                        undefined,
                                        `[묶음] ${title} [${packageIdx}]`
                                    );
                                }

                                Toast.show(
                                    `${title} ${block.TYPE_NAMES["DCCON"]} 묶음을 차단했습니다.`,
                                    false,
                                    3000
                                );

                                return;
                            }

                            block.add(
                                "DCCON",
                                code,
                                false,
                                false,
                                undefined,
                                `${title} [${packageIdx}]`
                            );

                            Toast.show(
                                `${title} ${block.TYPE_NAMES["DCCON"]}을 차단했습니다.`,
                                false,
                                3000
                            );
                        });

                    return;
                }

                let type: RefresherBlockType = "NICK";
                let value = this.memory.selected.nick;
                const extra = this.memory.selected.nick;

                if (this.memory.selected.uid) {
                    type = "ID";
                    value = this.memory.selected.uid;
                } else if (this.memory.selected.ip) {
                    type = "IP";
                    value = this.memory.selected.ip;
                }

                if (!value || !extra) return;

                block.add(type, value, false, false, undefined, extra);
                Toast.show(
                    `${block.TYPE_NAMES[type]} ${value}을(를) 차단했습니다.`,
                    false,
                    3000
                );
            }
        );
    },
    revoke(filter) {
        if (this.memory.uuid) filter.remove(this.memory.uuid);

        if (this.memory.uuid2) filter.remove(this.memory.uuid2);

        if (this.memory.addBlock) filter.remove(this.memory.addBlock);

        if (this.memory.requestBlock) filter.remove(this.memory.requestBlock);
    }
} as RefresherModule<{
    memory: {
        uuid: string | null;
        uuid2: string | null;
        selected: {
            nick: string | null;
            uid: string | null;
            ip: string | null;
            code: string | null;
            packageIdx: string | null;
        };
        lastSelect: number;
        addBlock: string | null;
        requestBlock: string | null;
    };
    settings: {
        replyRemove: RefresherCheckSettings;
        blur: RefresherCheckSettings;
    };
    require: ["filter", "eventBus", "block", "http"];
}>;
