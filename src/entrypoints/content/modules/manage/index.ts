import filter from "@/core/filtering";

import eventBus from "@/core/eventbus";
import {deletePost, fetchRatio, getPermBanFor, type RatioInfo} from "./helpers";
import {getBanReverseIndex} from "@/utils/ban";
import {insertWriterSpan} from "@/utils/userDataInsert";

type ManageModule = RefresherModule<{
    data: {
        ratio: Record<string, RatioInfo>;
    };
    memory: {
        gallViewContents: string;
        always: string;
        checkBox: string;
        newPostListEvent: (() => void) | null;
        content: string;
    };
    settings: {
        checkAllTargetUser: RefresherCheckSettings;
        checkViaShift: RefresherCheckSettings;
        checkCommentViaCtrl: RefresherCheckSettings;
        checkRatio: RefresherCheckSettings;
        alarmRatio: RefresherRangeSettings;
        deleteViaCtrl: RefresherCheckSettings;
        checkPermBan: RefresherCheckSettings;
        enableGifControl: RefresherCheckSettings;
    };
}>;

const createRatioSpan = (ratio: RatioInfo, alarmRatio: number): HTMLSpanElement => {
    const span = document.createElement("span");
    span.className = "ip ratio refresherUserData";
    span.textContent = `[${ratio.article}/${ratio.comment}]`;
    span.title = `${ratio.article}/${ratio.comment}`;

    if (alarmRatio > 0 && ratio.article + ratio.comment <= alarmRatio) {
        span.style.color = "red";
    }

    return span;
};

const setupGifControl = (ctx: ManageModule): string =>
    filter.add<HTMLVideoElement>(
        ".gallview_contents video",
        (element) => {
            if (!ctx.status.enableGifControl) return;

            const src = element.getAttribute("data-src");

            if (src?.includes("dcinside.com/dccon.php")) return;

            element.removeAttribute("onmousedown");
            element.setAttribute("controls", "");
        },
        {skipIfNotExists: true}
    );

const setupCheckboxHandlers = (ctx: ManageModule): string =>
    filter.add<HTMLInputElement>(
        ".article_chkbox",
        (element) => {
            if (element.dataset.refresherManageHandler === "true") return;
            element.dataset.refresherManageHandler = "true";

            element.addEventListener("click", (ev: MouseEvent) => {
                if (!ctx.enable) return;

                const container = element.closest<HTMLElement>(".ub-content, .cmt_nickbox, .search_comment");
                const writer = container?.querySelector<HTMLElement>(":scope > .ub-writer");

                const uid = writer?.dataset.uid;
                const ip = writer?.dataset.ip;
                const nick = writer?.dataset.nick;

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

                if (type && target && ctx.status.checkAllTargetUser && ev.shiftKey) {
                    // 닉네임에 따옴표 등이 들어가면 selector가 깨진다.
                    for (const post of document.querySelectorAll<HTMLElement>(`.ub-writer[${type}=${CSS.escape(target)}]`)) {
                        const checkbox = post.parentElement?.querySelector<HTMLInputElement>(".article_chkbox");
                        if (checkbox) checkbox.checked = (ev.target as HTMLInputElement).checked;
                    }
                }

                const li = element.closest<HTMLLIElement>("li");
                if (li && ctx.status.checkCommentViaCtrl && ev.ctrlKey && !li.id.startsWith("reply_")) {
                    const next = li.nextElementSibling;
                    if (next) {
                        for (const input of next.querySelectorAll<HTMLInputElement>(".article_chkbox")) {
                            input.checked = (ev.target as HTMLInputElement).checked;
                        }
                    }
                }
            });

            element.addEventListener("mouseover", (ev: MouseEvent) => {
                if (!ctx.enable || !ctx.status.checkViaShift || !ev.shiftKey) return;
                element.checked = !element.checked;
            });
        },
        {neverExpire: true}
    );

const setupCtrlDelete = (ctx: ManageModule): string =>
    filter.add(
        ".gall_list .ub-content",
        (element) => {
            if (element.dataset.refresherManageClick === "true") return;
            element.dataset.refresherManageClick = "true";

            element.addEventListener("click", (ev: MouseEvent) => {
                if (!ctx.enable || !ctx.status.deleteViaCtrl || !ev.ctrlKey) return;

                ev.preventDefault();
                ev.stopPropagation();

                const postId = element.dataset.no;
                if (postId) void deletePost(postId);
            });
        },
        {neverExpire: true}
    );

const setupWriterDisplay = (ctx: ManageModule): string =>
    filter.add(
        ".ub-writer:not([user_name])",
        (element) => {
            const uid = element.dataset.uid;

            if (ctx.status.checkPermBan && element.dataset.refresherPermBan !== "true") {
                const permBan = uid ? getPermBanFor(uid, getBanReverseIndex()) : undefined;

                if (permBan) {
                    element.dataset.refresherPermBan = "true";

                    const text = document.createElement("span");
                    text.style.color = "red";
                    text.className = "ip ratio refresherUserData";
                    text.textContent = `[${permBan}]`;
                    text.title = permBan;

                    insertWriterSpan(element, text, "after-icon");
                }
            }

            if (ctx.status.checkRatio && element.dataset.refresherRatio !== "true") {
                if (!Object.hasOwn(ctx.data.ratio, element.dataset.uid!)) return;

                const ratio = ctx.data.ratio[element.dataset.uid!];
                if (!ratio) return;

                element.dataset.refresherRatio = "true";
                insertWriterSpan(element, createRatioSpan(ratio, ctx.status.alarmRatio), "after-icon");
            }
        },
        {neverExpire: true}
    );

const handleNewPostList = async (ctx: ManageModule, articles: HTMLElement[]): Promise<void> => {
    const limitedArticles = articles.slice(0, 10);

    const ratioTargets: { article: HTMLElement; writer: HTMLElement | null; uid: string }[] = [];

    for (const article of limitedArticles) {
        const writer = article.querySelector<HTMLElement>(".ub-writer");
        const uid = writer?.dataset.uid;

        if (!uid) continue;

        if (ctx.status.checkPermBan) {
            const permBan = getPermBanFor(uid, getBanReverseIndex());

            if (permBan) {
                const permBanSpan = document.createElement("span");
                permBanSpan.style.color = "red";
                permBanSpan.className = "ip permBan refresherUserData";
                permBanSpan.title = permBan;
                permBanSpan.textContent = `[${permBan}]`;

                if (article.dataset.refresherPermBan === "true") {
                    article.querySelector(".permBan")?.replaceWith(permBanSpan);
                } else {
                    article.dataset.refresherPermBan = "true";
                    writer?.appendChild(permBanSpan);
                }
            }
        }

        if (!ctx.status.checkRatio) continue;

        ratioTargets.push({article, writer, uid});
    }

    const staleUids = new Set<string>();
    for (const {uid} of ratioTargets) {
        const cached = ctx.data.ratio?.[uid];
        if (!cached || Date.now() - cached.date > 3600000) {
            staleUids.add(uid);
        }
    }

    if (staleUids.size > 0) {
        const fetchedResults = await Promise.all(
            Array.from(staleUids).map(async (uid) => ({
                uid,
                result: await fetchRatio(uid)
            }))
        );

        // 한 번만 대입한다. data는 Proxy라 대입할 때마다 스토리지에 쓴다.
        const updated = {...ctx.data.ratio};
        for (const {uid, result} of fetchedResults) {
            if (result) updated[uid] = result;
        }
        ctx.data.ratio = updated;
    }

    for (const {article, writer, uid} of ratioTargets) {
        const ratio = ctx.data.ratio?.[uid];
        if (!ratio) continue;

        const ratioSpan = createRatioSpan(ratio, ctx.status.alarmRatio);

        if (article.dataset.refresherRatio === "true") {
            article.querySelector(".ratio")?.replaceWith(ratioSpan);
            continue;
        }

        article.dataset.refresherRatio = "true";
        writer?.appendChild(ratioSpan);
    }
};

export default {
    name: "관리",
    description: "무급 노예들을 위한 여러 편의 기능을 제공합니다.",
    url: /\/board\/(view|lists)/,
    status: {},
    data: {
        ratio: {}
    },
    memory: {
        gallViewContents: "",
        always: "",
        checkBox: "",
        newPostListEvent: null as (() => void) | null,
        content: ""
    },
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
            desc: "글댓비를 표시합니다. (1시간 마다 갱신, 새 글 작성시에만 조회)",
            type: "check",
            default: false
        },
        alarmRatio: {
            name: "깡계 알림",
            desc: "글댓합이 설정한 값 이하일 때 강조 표시합니다. (0이면 비활성화)",
            type: "range",
            default: 0,
            min: 0,
            max: 5000,
            step: 10
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
        },
        enableGifControl: {
            name: "GIF 조작 기능 활성화",
            desc: "GIF를 제어할 수 있는 기능을 활성화합니다.",
            type: "check",
            default: false
        }
    },
    func() {
        this.memory.gallViewContents = setupGifControl(this);
        this.memory.checkBox = setupCheckboxHandlers(this);
        this.memory.content = setupCtrlDelete(this);
        this.memory.always = setupWriterDisplay(this);
        this.memory.newPostListEvent = eventBus.on("newPostList", (articles: HTMLElement[]) => {
            void handleNewPostList(this, articles);
        });
    },
    revoke() {
        if (this.memory.gallViewContents) filter.remove(this.memory.gallViewContents);
        if (this.memory.checkBox) filter.remove(this.memory.checkBox);
        if (this.memory.always) filter.remove(this.memory.always);
        if (this.memory.newPostListEvent) this.memory.newPostListEvent();
        if (this.memory.content) filter.remove(this.memory.content);

        // 관리 모듈이 붙인 표시만 걷어낸다 (유저 정보 모듈 것과 클래스가 겹치지 않음).
        for (const span of document.querySelectorAll(".refresherUserData.ratio, .refresherUserData.permBan")) {
            span.remove();
        }

        for (const element of document.querySelectorAll<HTMLElement>("[data-refresher-ratio], [data-refresher-perm-ban]")) {
            delete element.dataset.refresherRatio;
            delete element.dataset.refresherPermBan;
        }
    }
} as ManageModule;