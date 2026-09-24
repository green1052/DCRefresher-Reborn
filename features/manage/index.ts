import {http} from "@/core/http/client";
import type {ModuleContext, ModuleDefinition} from "@/core/module/types";
import {galleryType, galleryTypeName, urls} from "@/core/http/urls";
import type {JsonValue} from "@/core/storage/types";
import {eventBus} from "@/core/eventbus/bus";
import {getBan} from "@/utils/ban";
import {insertWriterSpan} from "@/utils/userDataInsert";

interface RatioInfo {
    article: number;
    comment: number;
    date: number;
}

const GALLOG_API = "https://gall.dcinside.com/api/gallog_user_layer/gallog_content_reple";

const asRatios = (value: JsonValue | undefined): Record<string, RatioInfo> => (value ?? {}) as unknown as Record<string, RatioInfo>;

const makeSpan = (className: string, text: string): HTMLElement => {
    const span = document.createElement("span");
    span.className = className;
    span.textContent = text;
    span.title = text;
    return span;
};

const makeRatioSpan = (info: RatioInfo, alarmRatio: number): HTMLElement => {
    const span = makeSpan("ip ratio refresherUserData", `[${info.article}/${info.comment}]`);
    if (alarmRatio > 0 && info.article + info.comment <= alarmRatio) span.style.color = "red";
    return span;
};

const makePermBanSpan = (reasons: string): HTMLElement => {
    const span = makeSpan("ip permBan refresherUserData", `[${reasons}]`);
    span.style.color = "#e8645f";
    return span;
};

const fetchRatio = async (uid: string): Promise<RatioInfo | undefined> => {
    const text = await http.post(GALLOG_API, {
        headers: {"X-Requested-With": "XMLHttpRequest"},
        body: new URLSearchParams({ci_t: (await cookieStore.get("ci_c"))?.value ?? "", user_id: uid})
    }).text();

    const [article, comment] = text.split(",").map(Number);
    if (Number.isNaN(article) || Number.isNaN(comment) || article === undefined || comment === undefined) return undefined;

    return {article, comment, date: Date.now()};
};

const manageModule: ModuleDefinition = {
    id: "manage",
    name: "관리",
    description: "무급 노예들을 위한 여러 편의 기능을 제공합니다.",
    urls: [/\/board\/(view|lists)/],
    defaultEnable: false,

    settings: {
        checkAllTargetUser: {
            type: "check",
            name: "선택한 유저 전부 체크",
            desc: "Shift키를 누른 상태로 체크박스를 눌러 대상 유저 전부를 체크합니다. (아이디, IP, 이름 순서)",
            default: false
        },
        checkViaShift: {
            type: "check",
            name: "Shift 다중 체크",
            desc: "Shift키를 누른 상태로 드래그해 여러 항목을 체크합니다.",
            default: false
        },
        checkCommentViaCtrl: {
            type: "check",
            name: "Ctrl 대댓글 체크",
            desc: "Ctrl키를 누른 상태로 댓글을 클릭하면 대댓글도 체크합니다.",
            default: false
        },
        checkRatio: {
            type: "check",
            name: "글댓비 표시",
            desc: "글댓비를 표시합니다. (1시간 마다 갱신, 새 글 작성시에만 조회)",
            default: false
        },
        alarmRatio: {
            type: "range",
            name: "깡계 알림",
            desc: "글댓합이 설정한 값 이하일 때 강조 표시합니다. (0이면 비활성화)",
            default: 0,
            min: 0,
            max: 5000,
            step: 10,
            unit: "개"
        },
        deleteViaCtrl: {
            type: "check",
            name: "Ctrl로 삭제",
            desc: "Ctrl키를 누른 상태로 게시글을 클릭해 삭제합니다.",
            default: false
        },
        checkPermBan: {
            type: "check",
            name: "갱차 조회",
            desc: "갱신 차단 여부를 조회합니다.",
            default: false
        },
        enableGifControl: {
            type: "check",
            name: "GIF 조작 기능 활성화",
            desc: "GIF를 제어할 수 있는 기능을 활성화합니다.",
            default: false
        }
    },

    setup(ctx) {
        // ===== GIF 조작 =====
        ctx.addFilter(
            ".gallview_contents video",
            (element) => {
                if (!ctx.settings.enableGifControl) return;
                if (!(element instanceof HTMLVideoElement)) return;
                if (element.dataset.src?.includes("dcinside.com/dccon.php")) return;

                element.removeAttribute("onmousedown");
                element.setAttribute("controls", "");
            },
            {skipIfNotExists: true}
        );

        // ===== 체크박스 편의 =====
        ctx.addFilter(
            ".article_chkbox",
            (element) => {
                if (element.dataset.refresherManageHandler === "true") return;
                element.dataset.refresherManageHandler = "true";

                const parent = element.closest<HTMLElement>(".ub-content, .cmt_nickbox, .search_comment");
                const writer = parent?.querySelector<HTMLElement>(":scope > .ub-writer");
                const uid = writer?.dataset.uid;
                const ip = writer?.dataset.ip;
                const nick = writer?.dataset.nick;

                element.addEventListener("click", (event) => {
                    const source = event.target as HTMLInputElement;

                    if (ctx.settings.checkAllTargetUser && event.shiftKey && (uid || ip || nick)) {
                        const key = uid ? "uid" : ip ? "ip" : "nick";
                        const value: string = (uid ?? ip ?? nick) as string;

                        for (const other of document.querySelectorAll<HTMLElement>(`.ub-writer[data-${key}="${CSS.escape(value)}"]`)) {
                            const otherParent = other.closest<HTMLElement>(".ub-content, .cmt_nickbox, .search_comment");
                            otherParent?.querySelectorAll<HTMLInputElement>(".article_chkbox").forEach((box) => {
                                box.checked = (source as HTMLInputElement).checked;
                            });
                        }
                    }

                    if (ctx.settings.checkCommentViaCtrl && event.ctrlKey) {
                        const commentItem = element.closest<HTMLElement>("li");
                        if (!commentItem?.id.startsWith("reply_")) return;

                        // 원댓글(reply_1) 다음에 붙는 대댓글(reply_1_2)
                        let sibling = commentItem.nextElementSibling;
                        while (sibling instanceof HTMLElement && /^reply_\d+_\d+/.test(sibling.id)) {
                            sibling.querySelectorAll<HTMLInputElement>(".article_chkbox").forEach((box) => {
                                box.checked = (source as HTMLInputElement).checked;
                            });
                            sibling = sibling.nextElementSibling;
                        }
                    }
                });

                element.addEventListener("mouseover", (event) => {
                    if (ctx.settings.checkViaShift && event.shiftKey && !(element instanceof HTMLInputElement && element.checked)) {
                        if (element instanceof HTMLInputElement) element.checked = true;
                    }
                });
            },
            {neverExpire: true}
        );

        // ===== Ctrl 클릭 삭제 =====
        const deletePost = async (postId: string): Promise<void> => {
            const isMini = galleryType(location.href, "/") === "mini/";

            try {
                await http.post(isMini ? urls.manage.deleteMini : urls.manage.delete, {
                    headers: {"X-Requested-With": "XMLHttpRequest"},
                    body: new URLSearchParams({
                        ci_t: (await cookieStore.get("ci_c"))?.value ?? "",
                        id: document.querySelector<HTMLInputElement>("#gallery_id")?.value ?? "",
                        "nos[]": postId,
                        _GALLTYPE_: galleryTypeName(location.href)
                    })
                });
            } catch (error) {
                console.error("Failed to delete post:", error);
            }
        };

        ctx.addFilter(
            ".gall_list .ub-content",
            (element) => {
                if (element.dataset.refresherManageClick === "true") return;
                element.dataset.refresherManageClick = "true";

                element.addEventListener("click", (event) => {
                    if (!ctx.settings.deleteViaCtrl || !event.ctrlKey) return;

                    const postId = element.dataset.no;
                    if (!postId) return;

                    event.preventDefault();
                    event.stopPropagation();
                    void deletePost(postId);
                });
            },
            {neverExpire: true}
        );

        // ===== 갱차 / 글댓비 표시 =====
        ctx.addFilter(
            ".ub-writer:not([user_name])",
            (element) => {
                const uid = element.dataset.uid;
                if (!uid) return;

                if (ctx.settings.checkPermBan && element.dataset.refresherPermBan !== "true") {
                    element.dataset.refresherPermBan = "true";

                    const reasons = getBan(uid);
                    if (reasons) insertWriterSpan(element, makePermBanSpan(reasons), "after-icon");
                }

                if (ctx.settings.checkRatio && element.dataset.refresherRatio !== "true") {
                    element.dataset.refresherRatio = "true";

                    const cached = asRatios(ctx.data.ratio)[uid];
                    if (cached) insertWriterSpan(element, makeRatioSpan(cached, Number(ctx.settings.alarmRatio)), "after-icon");
                }
            },
            {neverExpire: true}
        );

        // ===== 새 글: 갱차 표시 + 글댓비 갱신 (1시간 캐시, 첫 10개) =====
        const offNewPostList = eventBus.on("newPostList", ({data: elements}) => {
            const ratios = asRatios(ctx.data.ratio);
            const stale: string[] = [];

            for (const post of elements.slice(0, 10)) {
                const writer = post.querySelector<HTMLElement>(".ub-writer");
                const uid = writer?.dataset.uid;
                if (!writer || !uid) continue;

                if (ctx.settings.checkPermBan) {
                    const reasons = getBan(uid);
                    const existing = writer.querySelector<HTMLElement>(".permBan");

                    if (reasons) {
                        const span = makePermBanSpan(reasons);
                        existing ? existing.replaceWith(span) : writer.append(span);
                    } else {
                        existing?.remove();
                    }
                }

                if (ctx.settings.checkRatio) {
                    const cached = ratios[uid];

                    if (cached && Date.now() - cached.date <= 3600_000) {
                        const span = makeRatioSpan(cached, Number(ctx.settings.alarmRatio));
                        const existing = writer.querySelector<HTMLElement>(".ratio");
                        existing ? existing.replaceWith(span) : writer.append(span);
                    } else if (!stale.includes(uid)) {
                        stale.push(uid);
                    }
                }
            }

            if (stale.length === 0) return;

            void Promise.all(stale.map(async (uid) => [uid, await fetchRatio(uid)] as const)).then((results) => {
                const fresh = results.filter((entry): entry is [string, RatioInfo] => Boolean(entry[1]));
                if (fresh.length === 0) return;

                // 1회 대입 (Proxy → 스토리지 증분 쓰기 방지)
                ctx.data.ratio = {
                    ...(asRatios(ctx.data.ratio) as Record<string, RatioInfo>),
                    ...Object.fromEntries(fresh.map(([uid, info]) => [uid, {...info, date: Date.now()}]))
                } as JsonValue;

                for (const post of elements.slice(0, 10)) {
                    const writer = post.querySelector<HTMLElement>(".ub-writer");
                    if (!writer?.dataset.uid) continue;

                    const match = fresh.find(([uid]) => uid === writer.dataset.uid);
                    if (!match) continue;

                    const span = makeRatioSpan(match[1], Number(ctx.settings.alarmRatio));
                    const existing = writer.querySelector<HTMLElement>(".ratio");
                    existing ? existing.replaceWith(span) : writer.append(span);
                }
            });
        });

        ctx.addCleanup(() => offNewPostList());
    },

    revoke(ctx) {
        for (const element of document.querySelectorAll<HTMLElement>(".refresherUserData.ratio, .refresherUserData.permBan")) {
            element.remove();
        }

        for (const element of document.querySelectorAll<HTMLElement>("[data-refresher-ratio], [data-refresher-perm-ban]")) {
            delete element.dataset.refresherRatio;
            delete element.dataset.refresherPermBan;
        }

        void ctx;
    }
};

export default manageModule;
