import block from "@/core/block";
import filter from "@/core/filtering";
import Cookies from "js-cookie";
import ky from "../utils/httpClient";

import communicate from "../core/communicate";
import {eventBus} from "../core/eventbus";
import {queryString} from "../utils/http";
import toast from "../utils/toast";

interface DcconDetailResponse {
    info?: {
        title: string;
        package_idx: string;
    };
    detail: Array<{ path: string }>;
}

interface BlockRequestOptions {
    target: "user" | "dccon";
    blockAllDccon?: boolean;
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
        requestBlock: null,
        blockSelected: null,
        dcconSelected: null,
        dcconAllSelected: null,
        contextMenuHandler: null
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
    func() {
        const hideElement = (element: HTMLElement, blur = false) => {
            if (blur) {
                element.classList.add("refresherBlur");
                return;
            }

            element.style.display = "none";
        };

        this.memory.uuid = filter.add(
            ".ub-writer",
            (element) => {
                const gallery = queryString("id");

                if (!gallery) return;

                const parent = element.parentElement;
                if (!parent) return;

                const title = parent.querySelector<HTMLElement>(".gall_tit > a:not([class])")?.textContent?.trim() ?? "";
                const tab = parent.querySelector<HTMLElement>(".gall_subject")?.textContent ?? "";

                const viewWrap = element.closest<HTMLElement>(".view_content_wrap");
                const text = location.pathname.includes("/view/") && viewWrap
                    ? viewWrap.querySelector(".write_div")?.textContent?.trim() ?? null
                    : null;

                const commentInfo = element.closest<HTMLElement>(".reply_info, .cmt_info");
                const commentContent = location.pathname.includes("/view/") && commentInfo
                    ? commentInfo.querySelector(".usertxt")?.textContent ?? null
                    : null;

                const nick = element.dataset.nick ?? null;
                const uid = element.dataset.uid ?? null;
                const ip = element.dataset.ip ?? null;

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
                    const post = parent;

                    if (post.classList.contains("ub-content")) {
                        hideElement(post, this.status.blur);
                        return;
                    }

                    const content = post.closest<HTMLElement>(".ub-content");

                    if (content) {
                        if (this.status.replyRemove) {
                            const next = content.nextElementSibling as HTMLElement | null;

                            if (next && !next.classList.contains("ub-content") && next.querySelector(":scope > .reply")) {
                                hideElement(next, this.status.blur);
                            }
                        }

                        hideElement(content, this.status.blur);
                    }
                } else if (text && block.check("TEXT", text, gallery) && viewWrap) {
                    const writeDiv = viewWrap.querySelector<HTMLElement>(".write_div");
                    if (writeDiv) writeDiv.textContent = "게시글 내용이 차단됐습니다.";
                }
            },
            {
                neverExpire: true
            }
        );

        this.memory.uuid2 = filter.add(
            ".written_dccon",
            (element) => {
                const gallery = queryString("id");

                if (!gallery) return;

                const src = element.getAttribute("src") ?? element.getAttribute("data-src") ?? "";
                const dccon = src.replace(/^.*no=/g, "").replace(/^&.*$/g, "");

                if (block.check("DCCON", dccon, gallery)) {
                    const comment = element.closest<HTMLElement>(".ub-content");
                    const hideTarget = comment ?? element.closest<HTMLElement>(".comment_dccon");

                    if (!hideTarget) return;

                    if (this.status.replyRemove) {
                        const next = hideTarget.nextElementSibling as HTMLElement | null;

                        if (next && !next.classList.contains("ub-content") && next.querySelector(":scope > .reply")) {
                            hideElement(next, this.status.blur);
                        }
                    }

                    hideElement(hideTarget, this.status.blur);
                }
            },
            {
                neverExpire: true
            }
        );

        this.memory.contextMenuHandler = (event: MouseEvent) => {
            if (!(event.target instanceof Element)) return;

            const dccon = event.target.closest<HTMLImageElement>(".written_dccon");
            if (dccon) {
                const code = (dccon.src || dccon.dataset.src || "")
                    .replace(/^.*no=/g, "")
                    .replace(/^&.*$/g, "");

                this.memory.selected = {
                    nick: null,
                    uid: null,
                    ip: null,
                    code,
                    packageIdx: null
                };
                this.memory.lastSelect = Date.now();
                return;
            }

            const writer = event.target.closest<HTMLElement>(".ub-writer");
            if (!writer) return;

            this.memory.selected = {
                nick: writer.dataset.nick ?? null,
                uid: writer.dataset.uid ?? null,
                ip: writer.dataset.ip ?? null,
                code: null,
                packageIdx: null
            };
            this.memory.lastSelect = Date.now();
        };
        document.addEventListener("contextmenu", this.memory.contextMenuHandler, true);

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

        this.memory.blockSelected = communicate.addHook("blockSelected", () => {
            eventBus.emit("refresherRequestBlock", {target: "user"});
        });

        this.memory.dcconSelected = communicate.addHook("dcconSelected", () => {
            eventBus.emit("refresherRequestBlock", {target: "dccon"});
        });

        this.memory.dcconAllSelected = communicate.addHook("dcconAllSelected", () => {
            eventBus.emit("refresherRequestBlock", {
                target: "dccon",
                blockAllDccon: true
            });
        });

        this.memory.requestBlock = eventBus.on("refresherRequestBlock", async (args: BlockRequestOptions) => {
            if (Date.now() - this.memory.lastSelect > 10000) {
                toast.show("차단할 대상을 다시 오른쪽 클릭해주세요.", "error");
                return;
            }

            const code = this.memory.selected.code;

            if (args.target === "dccon") {
                if (!code) {
                    toast.show("차단할 디시콘을 다시 오른쪽 클릭해주세요.", "error");
                    return;
                }

                const params = new URLSearchParams();
                params.set("ci_t", Cookies.get("ci_c") ?? "");
                params.set("code", code);

                try {
                    const json = await ky
                        .post(http.urls.dccon.detail, {
                            headers: {
                                "X-Requested-With": "XMLHttpRequest"
                            },
                            body: params
                        })
                        .json<DcconDetailResponse>();

                    if (!json?.info) {
                        throw new Error("디시콘 상세 정보가 없습니다.");
                    }

                    const title = json.info.title;
                    const packageIdx = json.info.package_idx;

                    if (args.blockAllDccon) {
                        const blockBundle = confirm(
                            "디시콘을 묶어서 차단하시겠습니까? (차단 목록에서는 한개로 표시됩니다.)"
                        );

                        if (blockBundle) {
                            const paths = json.detail.map(({path}) => path);
                            await block.add(
                                "DCCON",
                                `^(${paths.join("|")})$`,
                                true,
                                false,
                                undefined,
                                `[묶음] ${title} [${packageIdx}]`
                            );
                        } else {
                            for (const {path} of json.detail) {
                                await block.add(
                                    "DCCON",
                                    path,
                                    false,
                                    false,
                                    undefined,
                                    `${title} [${packageIdx}]`
                                );
                            }
                        }

                        toast.show(`${title} ${block.TYPE_NAMES.DCCON} 묶음을 차단했습니다.`);
                        return;
                    }

                    await block.add("DCCON", code, false, false, undefined, `${title} [${packageIdx}]`);
                    toast.show(`${title} ${block.TYPE_NAMES.DCCON}을 차단했습니다.`);
                } catch (error) {
                    console.error("Failed to block dccon:", error);
                    toast.show("디시콘 정보를 가져오거나 저장하는데 실패했습니다.", "error");
                }

                return;
            }

            let type: RefresherBlockType = "NICK";
            let value = this.memory.selected.nick;

            if (this.memory.selected.uid) {
                type = "ID";
                value = this.memory.selected.uid;
            } else if (this.memory.selected.ip) {
                type = "IP";
                value = this.memory.selected.ip;
            }

            if (!value) {
                toast.show("차단할 유저를 다시 오른쪽 클릭해주세요.", "error");
                return;
            }

            try {
                await block.add(type, value, false, false, undefined, this.memory.selected.nick ?? value);
                toast.show(`${block.TYPE_NAMES[type]} ${value}을(를) 차단했습니다.`);
            } catch (error) {
                console.error("Failed to save blocked user:", error);
                toast.show("차단 목록을 저장하는데 실패했습니다.", "error");
            }
        });
    },
    revoke() {
        if (this.memory.uuid) filter.remove(this.memory.uuid);

        if (this.memory.uuid2) filter.remove(this.memory.uuid2);

        if (this.memory.addBlock) eventBus.remove("refresherUserContextMenu", this.memory.addBlock);

        if (this.memory.requestBlock) eventBus.remove("refresherRequestBlock", this.memory.requestBlock);

        if (this.memory.blockSelected) communicate.clearHook("blockSelected", this.memory.blockSelected);

        if (this.memory.dcconSelected) communicate.clearHook("dcconSelected", this.memory.dcconSelected);

        if (this.memory.dcconAllSelected) communicate.clearHook("dcconAllSelected", this.memory.dcconAllSelected);

        if (this.memory.contextMenuHandler) {
            document.removeEventListener("contextmenu", this.memory.contextMenuHandler, true);
            this.memory.contextMenuHandler = null;
        }
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
        blockSelected: string | null;
        dcconSelected: string | null;
        dcconAllSelected: string | null;
        contextMenuHandler: ((event: MouseEvent) => void) | null;
    };
    settings: {
        replyRemove: RefresherCheckSettings;
        blur: RefresherCheckSettings;
    };
}>;
