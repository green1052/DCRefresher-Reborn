import block from "@/core/block";
import filter from "@/core/filtering";

import {eventBus} from "@/core/eventbus";
import {onMessage} from "@/http/messaging";
import {queryString} from "@/http/http";
import {handleBlockRequest} from "./request";

type BlockModule = RefresherModule<{
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
        addBlock: (() => void) | null;
        requestBlock: (() => void) | null;
        blockSelected: (() => void) | null;
        dcconSelected: (() => void) | null;
        dcconAllSelected: (() => void) | null;
        contextMenuHandler: ((event: MouseEvent) => void) | null;
    };
    settings: {
        replyRemove: RefresherCheckSettings;
        blur: RefresherCheckSettings;
    };
}>;

const hideElement = (element: HTMLElement, blur = false): void => {
    if (blur) {
        element.classList.add("refresherBlur");
        return;
    }

    element.style.display = "none";
};

const hideWithReply = (target: HTMLElement, ctx: BlockModule): void => {
    if (ctx.status.replyRemove) {
        const next = target.nextElementSibling as HTMLElement | null;

        if (next && !next.classList.contains("ub-content") && next.querySelector(":scope > .reply")) {
            hideElement(next, ctx.status.blur);
        }
    }

    hideElement(target, ctx.status.blur);
};

const setupWriterBlockFilter = (ctx: BlockModule, gallery: string | null): string =>
    filter.add(
        ".ub-writer",
        (element) => {
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
                if (parent.classList.contains("ub-content")) {
                    hideElement(parent, ctx.status.blur);
                    return;
                }

                const content = parent.closest<HTMLElement>(".ub-content");
                if (content) hideWithReply(content, ctx);
            } else if (text && block.check("TEXT", text, gallery) && viewWrap) {
                const writeDiv = viewWrap.querySelector<HTMLElement>(".write_div");
                if (writeDiv) writeDiv.textContent = "게시글 내용이 차단됐습니다.";
            }
        },
        {neverExpire: true}
    );

const setupDcconBlockFilter = (ctx: BlockModule, gallery: string | null): string =>
    filter.add(
        ".written_dccon",
        (element) => {
            if (!gallery) return;

            const src = element.getAttribute("src") ?? element.getAttribute("data-src") ?? "";
            const dccon = src.replace(/^.*no=/g, "").replace(/^&.*$/g, "");

            if (block.check("DCCON", dccon, gallery)) {
                const comment = element.closest<HTMLElement>(".ub-content");
                const hideTarget = comment ?? element.closest<HTMLElement>(".comment_dccon");

                if (!hideTarget) return;

                hideWithReply(hideTarget, ctx);
            }
        },
        {neverExpire: true}
    );

const createContextMenuHandler = (ctx: BlockModule): ((event: MouseEvent) => void) => {
    const handler = (event: MouseEvent) => {
        if (!(event.target instanceof Element)) return;

        const dccon = event.target.closest<HTMLImageElement>(".written_dccon");
        if (dccon) {
            const code = (dccon.src || dccon.dataset.src || "")
                .replace(/^.*no=/g, "")
                .replace(/^&.*$/g, "");

            ctx.memory.selected = {
                nick: null,
                uid: null,
                ip: null,
                code,
                packageIdx: null
            };
            ctx.memory.lastSelect = Date.now();
            return;
        }

        const writer = event.target.closest<HTMLElement>(".ub-writer");
        if (!writer) return;

        ctx.memory.selected = {
            nick: writer.dataset.nick ?? null,
            uid: writer.dataset.uid ?? null,
            ip: writer.dataset.ip ?? null,
            code: null,
            packageIdx: null
        };
        ctx.memory.lastSelect = Date.now();
    };

    document.addEventListener("contextmenu", handler, true);
    return handler;
};

const setupMessageHandlers = (ctx: BlockModule): void => {
    ctx.memory.addBlock = eventBus.on(
        "refresherUserContextMenu",
        (nick: string | null, uid: string | null, ip: string | null, code: string | null, packageIdx: string | null) => {
            ctx.memory.selected = {nick, uid, ip, code, packageIdx};
            ctx.memory.lastSelect = Date.now();
        }
    );

    ctx.memory.blockSelected = onMessage("blockSelected", () => {
        eventBus.emit("refresherRequestBlock", {target: "user"});
    });

    ctx.memory.dcconSelected = onMessage("dcconSelected", () => {
        eventBus.emit("refresherRequestBlock", {target: "dccon"});
    });

    ctx.memory.dcconAllSelected = onMessage("dcconAllSelected", () => {
        eventBus.emit("refresherRequestBlock", {target: "dccon", blockAllDccon: true});
    });

    ctx.memory.requestBlock = eventBus.on("refresherRequestBlock", async (args) => {
        await handleBlockRequest(args, ctx.memory.selected, Date.now() - ctx.memory.lastSelect);
    });
};

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
        const gallery = queryString("id");

        this.memory.uuid = setupWriterBlockFilter(this, gallery);
        this.memory.uuid2 = setupDcconBlockFilter(this, gallery);
        this.memory.contextMenuHandler = createContextMenuHandler(this);
        setupMessageHandlers(this);
    },
    revoke() {
        if (this.memory.uuid) filter.remove(this.memory.uuid);

        if (this.memory.uuid2) filter.remove(this.memory.uuid2);

        if (this.memory.addBlock) this.memory.addBlock();

        if (this.memory.requestBlock) this.memory.requestBlock();

        if (this.memory.blockSelected) this.memory.blockSelected();

        if (this.memory.dcconSelected) this.memory.dcconSelected();

        if (this.memory.dcconAllSelected) this.memory.dcconAllSelected();

        if (this.memory.contextMenuHandler) {
            document.removeEventListener("contextmenu", this.memory.contextMenuHandler, true);
            this.memory.contextMenuHandler = null;
        }
    }
} as BlockModule;