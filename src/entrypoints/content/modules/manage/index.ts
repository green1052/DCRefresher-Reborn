import filter from "@/core/filtering";

import eventBus from "@/core/eventbus";
import {deletePost, fetchRatio, getPermBanFor, type RatioInfo} from "./helpers";
import {getBanReverseIndex} from "@/utils/ban";

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
        this.memory.gallViewContents = filter.add<HTMLVideoElement>(
            ".gallview_contents video",
            (element) => {
                if (!this.status.enableGifControl) return;

                const src = element.getAttribute("data-src");

                if (src?.includes("dcinside.com/dccon.php")) return;

                element.removeAttribute("onmousedown");
                element.setAttribute("controls", "");
            },
            {skipIfNotExists: true}
        );

        this.memory.checkBox = filter.add<HTMLInputElement>(
            ".article_chkbox",
            (element) => {
                if (element.dataset.refresherManageHandler === "true") return;
                element.dataset.refresherManageHandler = "true";

                element.addEventListener("click", (ev: MouseEvent) => {
                    if (!this.enable) return;

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

                    if (type && target && this.status.checkAllTargetUser && ev.shiftKey) {
                        for (const post of document.querySelectorAll<HTMLElement>(`.ub-writer[${type}="${target}"]`)) {
                            const checkbox = post.parentElement?.querySelector<HTMLInputElement>(".article_chkbox");
                            if (checkbox) checkbox.checked = (ev.target as HTMLInputElement).checked;
                        }
                    }

                    const li = element.closest<HTMLLIElement>("li");
                    if (li && this.status.checkCommentViaCtrl && ev.ctrlKey && !li.id.startsWith("reply_")) {
                        const next = li.nextElementSibling;
                        if (next) {
                            for (const input of next.querySelectorAll<HTMLInputElement>(".article_chkbox")) {
                                input.checked = (ev.target as HTMLInputElement).checked;
                            }
                        }
                    }
                });

                element.addEventListener("mouseover", (ev: MouseEvent) => {
                    if (!this.enable || !this.status.checkViaShift || !ev.shiftKey) return;
                    element.checked = !element.checked;
                });
            },
            {neverExpire: true}
        );

        this.memory.content = filter.add(
            ".gall_list .ub-content",
            (element) => {
                if (element.dataset.refresherManageClick === "true") return;
                element.dataset.refresherManageClick = "true";

                element.addEventListener("click", (ev: MouseEvent) => {
                    if (!this.enable || !this.status.deleteViaCtrl || !ev.ctrlKey) return;

                    ev.preventDefault();
                    ev.stopPropagation();

                    const postId = element.dataset.no;
                    if (postId) void deletePost(postId);
                });
            },
            {neverExpire: true}
        );

        this.memory.always = filter.add(
            ".ub-writer:not([user_name])",
            (element) => {
                const uid = element.dataset.uid;

                if (this.status.checkPermBan && element.dataset.refresherPermBan !== "true") {
                    const permBan = uid ? getPermBanFor(uid, getBanReverseIndex()) : undefined;

                    if (permBan) {
                        element.dataset.refresherPermBan = "true";

                        const text = document.createElement("span");
                        text.style.color = "red";
                        text.className = "ip ratio refresherUserData";
                        text.textContent = `[${permBan}]`;
                        text.title = permBan;

                        const addBox = element.querySelector(".addbox");

                        if (addBox) {
                            const nickCon = addBox.querySelector(".writer_nikcon");

                            if (nickCon)
                                addBox.insertBefore(text, nickCon.nextSibling);
                            else
                                addBox.insertBefore(text, addBox.querySelector(".ip"));
                        } else {
                            const fl = element.querySelector(".fl > span");

                            if (fl) {
                                const flIpQuery = fl.querySelector(".writer_nikcon, .ip");
                                if (flIpQuery) fl.insertBefore(text, flIpQuery.nextSibling);
                            } else {
                                element.appendChild(text);
                            }
                        }
                    }
                }

                if (this.status.checkRatio && element.dataset.refresherRatio !== "true") {
                    if (!Object.hasOwn(this.data!.ratio, element.dataset.uid!)) return false;

                    const ratio = this.data!.ratio[element.dataset.uid!];

                    if (!ratio) return false;

                    element.dataset.refresherRatio = "true";

                    const text = document.createElement("span");
                    text.className = "ip ratio refresherUserData";
                    text.textContent = `[${ratio.article}/${ratio.comment}]`;
                    text.title = `${ratio.article}/${ratio.comment}`;

                    if (this.status.alarmRatio > 0) {
                        const calculatedRatio = ratio.article + ratio.comment;

                        if (calculatedRatio <= this.status.alarmRatio) {
                            text.style.color = "red";
                        }
                    }

                    const addBox = element.querySelector(".addbox");

                    if (addBox) {
                        const flIpQuery = addBox.querySelector(".writer_nikcon, .ip");
                        addBox.insertBefore(text, flIpQuery?.nextSibling ?? null);
                    } else {
                        const fl = element.querySelector(".fl > span");

                        if (fl) {
                            const flIpQuery = fl.querySelector(".writer_nikcon, .ip");
                            if (flIpQuery) fl.insertBefore(text, flIpQuery.nextSibling);
                        } else {
                            element.appendChild(text);
                        }
                    }
                }
            },
            {
                neverExpire: true
            }
        );

        const updateRatioStore = (uid: string, result: RatioInfo): void => {
            const deepCopy = {...this.data!.ratio};
            deepCopy[uid] = result;
            this.data!.ratio = deepCopy;
        };

        this.memory.newPostListEvent = eventBus.on("newPostList", async (articles) => {
            const limitedArticles = articles.slice(0, 10);

            // 1단계: permBan DOM 처리 + ratio 처리 대상 수집 (동기)
            const ratioTargets: { article: HTMLElement; writer: HTMLElement | null; uid: string }[] = [];

            for (const article of limitedArticles) {
                const writer = article.querySelector<HTMLElement>(".ub-writer");
                const uid = writer?.dataset.uid;

                if (!uid) continue;

                if (this.status.checkPermBan) {
                    const permBan = getPermBanFor(uid, getBanReverseIndex());

                    if (permBan) {
                        const permBanSpan = document.createElement("span");
                        permBanSpan.style.color = "red";
                        permBanSpan.className = "ip permBan refresherUserData";
                        permBanSpan.title = permBan;
                        permBanSpan.textContent = `[${permBan}]`;

                        if (article.dataset.refresherPermBan === "true") {
                            const existing = article.querySelector(".permBan");
                            existing?.replaceWith(permBanSpan);
                        } else {
                            article.dataset.refresherPermBan = "true";
                            writer?.appendChild(permBanSpan);
                        }
                    }
                }

                if (!this.status.checkRatio) continue;

                ratioTargets.push({article, writer, uid});
            }

            // 2단계: 캐시 미스 대상 식별
            const staleUids = new Set<string>();
            for (const {uid} of ratioTargets) {
                const cached = this.data!.ratio?.[uid];
                if (!cached || Date.now() - cached.date > 3600000) {
                    staleUids.add(uid);
                }
            }

            // 3단계: ratio 병렬 fetch (캐시 미스만)
            if (staleUids.size > 0) {
                const fetchedResults = await Promise.all(
                    Array.from(staleUids).map(async (uid) => {
                        const result = await fetchRatio(uid);
                        return {uid, result};
                    })
                );

                // 4단계: fetch 결과를 data에 일괄 반영 (race condition 방지)
                for (const {uid, result} of fetchedResults) {
                    if (result) updateRatioStore(uid, result);
                }
            }

            // 5단계: ratio DOM 처리 (순차, 캐시에서 읽기)
            for (const {article, writer, uid} of ratioTargets) {
                const ratio = this.data!.ratio?.[uid];
                if (!ratio) continue;

                const ratioSpan = document.createElement("span");
                ratioSpan.className = "ip ratio refresherUserData";
                ratioSpan.title = `${ratio.article}/${ratio.comment}`;
                ratioSpan.textContent = `[${ratio.article}/${ratio.comment}]`;

                if (this.status.alarmRatio > 0) {
                    const calculatedRatio = ratio.article + ratio.comment;

                    if (calculatedRatio <= this.status.alarmRatio) {
                        ratioSpan.style.color = "red";
                    }
                }

                if (article.dataset.refresherRatio === "true") {
                    const existing = article.querySelector(".ratio");
                    existing?.replaceWith(ratioSpan);
                    continue;
                }

                article.dataset.refresherRatio = "true";
                writer?.appendChild(ratioSpan);
            }
        });
    },
    revoke() {
        if (this.memory.gallViewContents) filter.remove(this.memory.gallViewContents);
        if (this.memory.checkBox) filter.remove(this.memory.checkBox);
        if (this.memory.always) filter.remove(this.memory.always);
        if (this.memory.newPostListEvent) this.memory.newPostListEvent();
        if (this.memory.content) filter.remove(this.memory.content);
    }
} as RefresherModule<{
    data: {
        ratio: Record<string, { article: number; comment: number; date: number }>;
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