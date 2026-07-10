import eventBus from "@/core/eventbus";
import filter from "@/core/filtering";
import * as block from "../core/block";
import Frame, {type FrameScrollApi} from "../core/frame";
import type {PreviewFrame} from "../core/PreviewFrame";
import {submitComment} from "../utils/comment";
import * as http from "../utils/http";
import {queryString} from "../utils/http";
import {getRelevantData} from "../utils/getRelevantData";
import {makeBodyFrame as makeBodyFrameFn} from "../utils/makeBodyFrame";
import {createMiniPreview, miniPreviewClose, miniPreviewCreate, miniPreviewMove} from "../utils/miniPreview";
import {PostCache} from "../utils/PostCache";
import {blockPreset, panel, removeAdminKeyPressHandler} from "../utils/previewPanel";
import {previewRequest} from "../utils/previewRequest";
import {ScrollDetection} from "../utils/scrollDetection";
import toast from "../utils/toast";
import {User} from "../utils/user";
import * as storage from "../utils/webStorage";
import {writeClipboard} from "../utils/writeClipboard";

type PreviewFrameAppApi = FrameScrollApi;

let blurConfig = false;
let replyConfig = false;
let configReady: Promise<void> | null = null;

const initConfigs = (): Promise<void> => {
    if (!configReady) {
        configReady = (async () => {
            if (!(await storage.get<boolean>("컨텐츠 차단.enable"))) return;

            const [blur, replyRemove] = await Promise.all([
                storage.get<boolean>("컨텐츠 차단.blur"),
                storage.get<boolean>("컨텐츠 차단.replyRemove")
            ]);

            blurConfig = blur;
            replyConfig = replyRemove;
        })();
    }
    return configReady;
};

void initConfigs();

let gifControlConfig = false;
let gifControlReady: Promise<void> | null = null;

const initGifControl = (): Promise<void> => {
    if (!gifControlReady) {
        gifControlReady = (async () => {
            gifControlConfig =
                (await storage.get<boolean>("관리.enable")) && (await storage.get<boolean>("관리.enableGifControl"));
        })();
    }
    return gifControlReady;
};

void initGifControl();

const postCaches = new PostCache();
const miniPreview = createMiniPreview();

let previewNavigationKeyDown: ((ev: KeyboardEvent) => void) | null = null;

let frame: Frame | undefined;

export default {
    name: "미리보기",
    description: "글을 오른쪽 클릭 했을때 미리보기 창을 만들어줍니다.",
    url: /\/board\/(view|lists)/,
    status: {},
    memory: {
        preventOpen: false,
        lastPress: 0,
        uuid: null,
        popStateHandler: null,
        signal: null,
        controller: null,
        historyClose: false,
        titleStore: null,
        urlStore: null,
        refreshIntervalId: null,
        newPostListEvent: null,
        cacheButtonFilterId: null,
        imageBlockClickHandler: null,
        elementEventController: null
    },
    enable: true,
    default_enable: true,
    settings: {
        tooltipMode: {
            name: "툴팁 미리보기 표시",
            desc: "마우스를 올려두면 글 내용만 빠르게 볼 수 있는 툴팁을 추가합니다.",
            type: "check",
            default: false
        },
        tooltipMediaHide: {
            name: "툴팁 미리보기 미디어 숨기기",
            desc: "툴팁 미리보기 화면에서 미디어를 숨깁니다.",
            type: "check",
            default: false
        },
        tooltipDelay: {
            name: "툴팁 미리보기 딜레이",
            desc: "툴팁 미리보기가 나타나기까지의 시간을 설정합니다.",
            type: "range",
            default: 0,
            min: 0,
            max: 1000,
            step: 50,
            unit: "ms"
        },
        tooltipInteraction: {
            name: "툴팁 미리보기 상호작용",
            desc: "툴팁 미리보기에서 마우스 클릭이나 휠 스크롤을 가능하게 합니다. (툴팁 미리보기 딜레이 설정 필수)",
            type: "check",
            default: false
        },
        tooltipRatioDisable: {
            name: "툴팁 미리보기 글댓비 강조시 비활성화",
            desc: "글댓비 강조가 활성화된 경우 툴팁 미리보기를 비활성화합니다.",
            type: "check",
            default: false
        },
        reversePreviewKey: {
            name: "키 반전",
            desc: "오른쪽 버튼 대신 왼쪽 버튼으로 미리보기를 엽니다.",
            type: "check",
            default: false
        },
        longPressDelay: {
            name: "기본 마우스 오른쪽 클릭 딜레이",
            desc: "마우스 오른쪽 버튼을 해당 밀리초 이상 눌러 뗄 때 기본 우클릭 메뉴가 나오게 합니다.",
            type: "range",
            default: 300,
            min: 200,
            max: 2000,
            step: 50,
            unit: "ms"
        },
        scrollToSkip: {
            name: "스크롤하여 게시글 이동",
            desc: "맨 위나 아래로 스크롤하여 다음 게시글로 이동할 수 있게 합니다.",
            type: "check",
            default: true
        },
        colorPreviewLink: {
            name: "게시글 URL 변경",
            desc: "미리보기를 열면 게시글의 URL을 변경하여 브라우저 탐색으로 게시글을 바꿀 수 있게 해줍니다.",
            type: "check",
            default: true
        },
        autoRefreshComment: {
            name: "댓글 자동 새로고침",
            desc: "댓글을 일정 주기마다 자동으로 새로고침합니다.",
            type: "check",
            default: false
        },
        commentRefreshInterval: {
            name: "댓글 자동 새로고침 주기",
            desc: "위의 옵션이 켜져있을 시 댓글을 새로고침할 주기를 설정합니다.",
            type: "range",
            default: 10000,
            min: 3000,
            max: 20000,
            step: 100,
            unit: "ms"
        },
        toggleBlur: {
            name: "게시글 배경 블러 활성화",
            desc: "미리보기 창의 배경을 블러 처리하여 미관을 돋보이게 합니다. (성능 하락 영향 있음)",
            type: "check",
            default: true
        },
        toggleBackgroundBlur: {
            name: "바깥 배경 블러 활성화",
            desc: "미리보기 창의 바깥 배경을 블러 처리하여 미관을 돋보이게 합니다. (성능 하락 영향 있음)",
            type: "check",
            default: false
        },
        toggleAdminPanel: {
            name: "관리 패널 활성화",
            desc: "갤러리에 관리 권한이 있는 경우 창 옆에 관리 패널을 표시합니다.",
            type: "check",
            default: true
        },
        useKeyPress: {
            name: "관리 패널 > 키 제어",
            desc: "관리 패널이 활성화된 경우 단축키를 눌러 빠르게 관리할 수 있습니다.",
            type: "check",
            default: true
        },
        blockPresetDay: {
            name: "관리 패널 > 차단 프리셋 > 차단 기간",
            desc: "차단 시 기본으로 선택할 차단 기간을 설정합니다.",
            type: "option",
            default: "1",
            items: {
                "1": "1시간",
                "6": "6시간",
                "24": "1일",
                "168": "7일",
                "336": "14일",
                "744": "31일"
            }
        },
        blockPresetReason: {
            name: "관리 패널 > 차단 프리셋 > 차단 사유",
            desc: "차단 시 기본으로 선택할 차단 사유를 설정합니다.",
            type: "text",
            default: ""
        },
        blockPresetDelete: {
            name: "관리 패널 > 차단 프리셋 > 선택한 글 삭제",
            desc: "차단 시 선택한 글을 삭제합니다.",
            type: "check",
            default: false
        },
        blockPresetUserType: {
            name: "관리 패널 > 차단 프리셋 > 식별 코드 차단 시 IP 동시 차단",
            desc: "차단 시 선택한 글을 삭제합니다.",
            type: "check",
            default: false
        },
        expandRecognizeRange: {
            name: "게시글 목록 인식 범위 확장",
            desc: "게시글의 오른쪽 클릭을 인식하는 범위를 칸 전체로 확장합니다.",
            type: "check",
            default: false
        },
        experimentalComment: {
            name: "댓글 기능 활성화",
            desc: "댓글을 작성할 수 있습니다.",
            type: "check",
            default: false
        },
        disableCache: {
            name: "캐시 비활성화",
            desc: "캐시를 사용하지 않습니다. (툴팁 미리보기 제외)",
            type: "check",
            default: false
        },
        archiveArticle: {
            name: "삭제된 글 & 댓글 보존",
            desc: "삭제된 글과 댓글을 보존합니다. (캐시 비활성화 시 작동 안함)",
            type: "check",
            default: false
        },
        newArticleArchive: {
            name: "새 글 보존",
            desc: "새로고침 시 불러오는 글을 자동으로 불러오고 보존합니다. (캐시 비활성화 시 작동 안함)",
            type: "check",
            default: false
        },
        blockImage: {
            name: "이미지 아이콘 없는 이미지 차단",
            desc: "이미지가 없는 게시글에 이미지가 있을 경우 차단합니다.",
            type: "check",
            default: false
        }
    },
    func() {
        this.memory.elementEventController?.abort();
        this.memory.elementEventController = new AbortController();
        const elementEventSignal = this.memory.elementEventController.signal;

        if (!this.status.disableCache) {
            this.memory.cacheButtonFilterId = filter.add(".page_head .gall_issuebox", (element) => {
                if (element.querySelector("[data-refresher-cache-button]")) return;

                const button = document.createElement("button");
                button.type = "button";
                button.innerHTML = "캐시";
                button.dataset.refresherCacheButton = "true";
                button.addEventListener("click", () => {
                    const div = document.createElement("div");
                    div.className = "refresher-cache-popup";
                    div.innerHTML = `
                        <div style="display: flex">
                            <h3>캐시</h3>
                            <div class="close">
                                <div class="cross"></div>
                                <div class="cross"></div>
                            </div>
                        </div>
                        <hr/>
                        <div>
                            <ul>
                                ${Object.entries(postCaches.caches)
                        .map(
                            ([key, value]) =>
                                `<li data-cache-key="${key}"><span>${value.post?.title ?? key}</span></li>`
                        )
                        .join("")}
                            </ul>
                        </div>
                    `;

                    div.querySelector(".close")!.addEventListener("click", () => {
                        div.remove();
                    });

                    const ul = div.querySelector("ul")!;
                    ul.addEventListener("click", (e) => {
                        const target = e.target as HTMLElement;
                        const li = target.closest("li");
                        if (!li) return;
                        const key = (li as HTMLElement).dataset.cacheKey;
                        if (!key) return;

                        const value = postCaches.caches[key];

                        if (!value || !value.post) return;

                        const gallery = new URL(location.href).searchParams.get("id") ?? "";

                        previewFrame(
                            null,
                            {
                                gallery,
                                id: value.post.id,
                                title: value.post.title,
                                link: `https://gall.dcinside.com/${http.galleryType(location.href)}/board/view/?id=${gallery}&no=${value.post.id}`,
                                notice: false,
                                recommend: false,
                                type: ""
                            },
                            true
                        );
                    });

                    document.body.append(div);
                });

                element.appendChild(button);
            });
        }

        if (!this.status.disableCache && this.status.newArticleArchive)
            this.memory.newPostListEvent = eventBus.on("newPostList", async (articles: HTMLElement[]) => {
                const limited = articles.slice(0, 5);

                for (const article of limited) {
                    const url = new URL((article.querySelector(".gall_tit > a") as HTMLAnchorElement).getAttribute("href") ?? "", "https://gall.dcinside.com");
                    const gallery = url.searchParams.get("id") ?? "";
                    const no = url.searchParams.get("no") ?? "";
                    const controller = new AbortController();
                    const post = await previewRequest.post(url.href, gallery, no, controller.signal);

                    postCaches.set(`${gallery}${no}`, {
                        date: Date.now(),
                        post
                    });
                }
            });

        this.memory.imageBlockClickHandler = (ev: MouseEvent) => {
            if (!(ev.target instanceof Element)) return;

            const button = ev.target.closest<HTMLElement>(".btn_img_block");
            if (!button) return;

            ev.preventDefault();
            ev.stopPropagation();

            button.style.display = "none";
            const img = button.closest("div")?.querySelector("img");
            if (img) img.style.display = "";
        };
        document.addEventListener("click", this.memory.imageBlockClickHandler);

        blockPreset.day = this.status.blockPresetDay;
        blockPreset.reason = this.status.blockPresetReason;
        blockPreset.delete = this.status.blockPresetDelete;
        blockPreset.user_type = this.status.blockPresetUserType;

        let postFetchedData: IPostInfo;
        let currentPreData: GalleryPreData | null = null;
        const gallery = queryString("id") ?? undefined;

        const getFrameApp = (): FrameScrollApi | undefined => frame?.app;

        const makeBodyFrame = (
            frame: PreviewFrame,
            preData: GalleryPreData,
            signal: AbortSignal,
            historySkip?: boolean
        ) => {
            makeBodyFrameFn({
                frame,
                preData,
                signal,
                historySkip,
                gallery,
                disableCache: this.status.disableCache,
                colorPreviewLink: this.status.colorPreviewLink,
                gifControl: gifControlConfig,
                blockImage: this.status.blockImage,
                postCaches,
                getGroupElement: () => getFrameApp()?.groupElement
            });
        };

        const makeCommentFrame = (frame: PreviewFrame, preData: GalleryPreData, signal: AbortSignal) => {
            frame.data.load = true;
            frame.title = "댓글";
            frame.subtitle = "로딩 중...";
            frame.data.useWriteComment = this.status.experimentalComment;

            let postDom: Document;

            new Promise<GalleryPreData | null>((resolve) => {
                let eventId = "";

                const abortHandler = () => {
                    if (eventId) {
                        eventBus.remove("RefresherPostCommentIDLoaded", eventId, true);
                    }
                    resolve(null);
                };

                eventId = eventBus.on(
                    "RefresherPostCommentIDLoaded",
                    (commentId: string, commentNo: string) => {
                        signal.removeEventListener("abort", abortHandler);
                        resolve({
                            gallery: commentId,
                            id: commentNo,
                            type: ""
                        });
                    },
                    {
                        once: true
                    }
                );

                signal.addEventListener("abort", abortHandler, {once: true});
            }).then((postData) => {
                if (!postData || signal.aborted) return;

                postDom = postFetchedData.dom!;

                frame.functions.writeComment = async (
                    type: "text" | "dccon",
                    memo: string | DcinsideDccon[],
                    commentNo: string | null,
                    replyNo: string | null,
                    user: { name: string; pw?: string },
                    bigDccon: boolean
                ) => {
                    if (!postFetchedData) {
                        toast.show("게시글이 로딩될 때까지 잠시 기다려주세요.", "error");
                        return false;
                    }

                    const requireCapCode = postFetchedData.requireCommentCaptcha;

                    const codeSrc = requireCapCode ? await previewRequest.captcha(preData, "comment") : undefined;

                    const getGreCaptchaToken = () =>
                        new Promise<string | undefined>((resolve) => {
                            let settled = false;

                            const finish = (token?: string) => {
                                if (settled) return;
                                settled = true;
                                window.clearTimeout(timeoutId);
                                window.removeEventListener("message", grecaptchaHandler);
                                resolve(token);
                            };

                            const grecaptchaHandler = (ev: MessageEvent) => {
                                if (
                                    ev.source !== window ||
                                    !ev.data ||
                                    ev.data.type !== "refresherGrecaptchaToken"
                                ) {
                                    return;
                                }

                                finish(typeof ev.data.token === "string" ? ev.data.token : undefined);
                            };

                            const timeoutId = window.setTimeout(() => finish(), 3000);
                            window.addEventListener("message", grecaptchaHandler);

                            window.postMessage(
                                {
                                    type: "refresherGrecaptcha",
                                    action: "comment_token"
                                },
                                "*"
                            );
                        });

                    const grecaptcha = await getGreCaptchaToken();

                    const req = async (captcha?: string) => {
                        const res = await submitComment(
                            postData,
                            user,
                            postDom,
                            memo,
                            commentNo,
                            replyNo,
                            bigDccon,
                            captcha,
                            grecaptcha
                        );

                        if (res.result === "false" || res.result === "PreNotWorking") {
                            toast.show(res.message!, "error");
                            return false;
                        } else {
                            return true;
                        }
                    };

                    return codeSrc ? await panel.captcha(codeSrc, req) : req();
                };

                if (this.memory.refreshIntervalId) clearInterval(this.memory.refreshIntervalId);

                this.memory.refreshIntervalId = window.setInterval(() => {
                    if (this.status.autoRefreshComment) frame.functions.retry(false);
                }, this.status.commentRefreshInterval);
            });

            const deletePressCount: Record<string, number> = {};

            frame.functions.deleteComment = async (commentId: string, password: string, admin: boolean) => {
                if (!preData.link) return false;

                if (!password) {
                    if (deletePressCount[commentId] + 1000 < Date.now()) {
                        deletePressCount[commentId] = 0;
                    }

                    if (!deletePressCount[commentId]) {
                        toast.show("한번 더 누르면 댓글을 삭제합니다.", "warning", 1000);

                        deletePressCount[commentId] = Date.now();

                        return false;
                    }

                    deletePressCount[commentId] = 0;
                }

                const typeName = http.galleryTypeName(preData.link);
                if (!typeName.length) return false;

                return (
                    admin && !password
                        ? previewRequest.adminDeleteComment(preData, commentId, signal)
                        : previewRequest.userDeleteComment(preData, commentId, signal, password)
                )
                    .then((v) => {
                        if (typeof v === "boolean") {
                            if (!v) return false;

                            return v;
                        }

                        if (v.includes("||")) {
                            const parsed = v.split("||");

                            if (parsed[0] !== "true") {
                                toast.show(parsed[1], "error");

                                return false;
                            }
                        }

                        if (v[0] !== "{") {
                            if (v !== "true") {
                                toast.show(v, "error");
                                return false;
                            }

                            toast.show("댓글을 삭제하였습니다.");
                        } else {
                            const parsed = JSON.parse(v);

                            if (parsed.result !== "fail") {
                                toast.show("댓글을 삭제하였습니다.");
                            } else {
                                toast.show(parsed.msg, "error");
                            }
                        }

                        frame.functions.retry();

                        return true;
                    })
                    .catch(() => false);
            };

            frame.functions.load = async (useCache = true) => {
                frame.data.load = true;
                frame.error = undefined;

                const getCommentInfo = async (): Promise<DcinsideComments> => {
                    if (useCache && !this.status.disableCache) {
                        const cache = postCaches.get(`${preData.gallery}${preData.id}`);

                        if (cache?.comment && postFetchedData.commentCount === cache.comment.total_cnt) {
                            return cache.comment;
                        }
                    }

                    const response = await previewRequest.comments(
                        {
                            link: preData.link!,
                            gallery: preData.gallery,
                            id: preData.id
                        },
                        signal
                    );

                    if (!response) throw new Error("Can not fetch comment data.");

                    return response;
                };

                try {
                    const comments = await getCommentInfo();
                    let threadCounts = 0;
                    let commentCounts = 0;
                    let needRefresh = false;

                    if (comments.comments) {
                        const cache = postCaches.get(`${preData.gallery}${preData.id}`);
                        const cacheComment = cache?.comment?.comments;

                        comments.comments = comments.comments.filter(
                            (v: DcinsideCommentObject) => v.nicktype !== "COMMENT_BOY"
                        );

                        if (this.status.archiveArticle && cacheComment) {
                            const restoreArchivedComments = (cachedComments: DcinsideCommentObject[]) => {
                                const currentCommentMap = new Map(comments.comments!.map((c) => [c.no, c]));

                                cachedComments.forEach((cachedComment: DcinsideCommentObject) => {
                                    const existingComment = currentCommentMap.get(cachedComment.no);

                                    if (!existingComment) {
                                        needRefresh = true;
                                        cachedComment.is_delete = "1";

                                        if (cachedComment.depth === 1) {
                                            const insertReplyComment = (
                                                comments: DcinsideCommentObject[],
                                                replyComment: DcinsideCommentObject
                                            ) => {
                                                const reversedComments = [...comments].reverse();

                                                const parentComment = reversedComments.find(
                                                    (comment: DcinsideCommentObject) => {
                                                        if (comment.c_no === replyComment.c_no) {
                                                            return true;
                                                        }
                                                        return comment.no === replyComment.c_no;
                                                    }
                                                );

                                                if (parentComment) {
                                                    const parentIndex = comments.indexOf(parentComment);
                                                    const shouldInsertAfter = parentComment.no > replyComment.no;
                                                    const insertIndex = parentIndex + (shouldInsertAfter ? 0 : 1);

                                                    comments.splice(insertIndex, 0, replyComment);
                                                } else {
                                                    comments.push(replyComment);
                                                }
                                            };

                                            insertReplyComment(comments.comments!, cachedComment);
                                        } else {
                                            comments.comments!.push(cachedComment);
                                        }
                                    } else if (existingComment.is_delete !== "0") {
                                        cachedComment.is_delete = "2";
                                        const targetIndex = comments.comments!.indexOf(existingComment);
                                        comments.comments![targetIndex] = cachedComment;
                                    }
                                });
                            };

                            restoreArchivedComments(cacheComment);
                        }

                        postCaches.set(`${preData.gallery}${preData.id}`, {
                            date: Date.now(),
                            comment: comments
                        });

                        comments.comments.forEach((v: DcinsideCommentObject) => {
                            v.user = new User(
                                v.name,
                                v.user_id || null,
                                v.ip || null,
                                new DOMParser()
                                    .parseFromString(v.gallog_icon, "text/html")
                                    .querySelector("a.writer_nikcon img")
                                    ?.getAttribute("src") || null
                            );
                        });

                        let parentComment: DcinsideCommentObject | null = null;

                        comments.comments = comments.comments.filter((comment: DcinsideCommentObject) => {
                            if (replyConfig && comment.c_no === parentComment?.no) {
                                if (blurConfig) {
                                    comment.memo = "댓글 내용이 차단됐습니다.";
                                    comment.is_delete = "1";
                                } else {
                                    return false;
                                }
                            }

                            const check: {
                                [index in RefresherBlockType]?: string;
                            } = {
                                NICK: comment.name
                            };

                            if (comment.user_id) {
                                check.ID = comment.user_id;
                            }

                            if (comment.ip) {
                                check.IP = comment.ip;
                            }

                            if (/<(img|video) class=/.test(comment.memo)) {
                                const match = /https:\/\/dcimg5\.dcinside\.com\/dccon\.php\?no=(\w*)/g.exec(
                                    comment.memo
                                );
                                if (!match) return true;
                                check.DCCON = match[1];
                            } else {
                                check.COMMENT = comment.memo;
                            }

                            const isBlocked = block.checkAll(check, gallery);

                            if (isBlocked) {
                                if (replyConfig && comment.c_no === 0) {
                                    parentComment = comment;
                                }

                                if (blurConfig) {
                                    comment.memo = "댓글 내용이 차단됐습니다.";
                                    comment.is_delete = "1";
                                } else {
                                    return false;
                                }
                            }

                            return true;
                        });

                        threadCounts =
                            comments.comments.length === 0
                                ? 0
                                : comments.comments
                                    .map((v: DcinsideCommentObject) => Number(v.depth === 0))
                                    .reduce((a: number, b: number) => a + b);
                        commentCounts = comments.comments.length;
                    } else if (this.status.archiveArticle) {
                        const cache = postCaches.get(`${preData.gallery}${preData.id}`);
                        const cacheComment = cache?.comment?.comments;

                        if (cacheComment?.length) {
                            needRefresh = true;

                            const restoredComments = cacheComment.map((comment: DcinsideCommentObject) => ({
                                ...comment,
                                is_delete: "1"
                            }));

                            comments.comments = restoredComments;
                            threadCounts = restoredComments.filter(
                                (comment: DcinsideCommentObject) => comment.depth === 0
                            ).length;
                            commentCounts = comments.comments.length;
                        }
                    }

                    frame.subtitle = `${
                        (commentCounts !== threadCounts && `쓰레드 ${threadCounts}개, 총 댓글`) || ""
                    } ${commentCounts}개`;

                    frame.data.comments = comments;

                    if (needRefresh) {
                        const frameComponent = getFrameApp()?.commentFrameRef;
                        frameComponent?.incrementCommentKey?.();
                    }
                } catch (e) {
                    if (frame.data.comments) {
                        toast.show(String(e), "error");
                    } else {
                        frame.error = {
                            title: "댓글",
                            detail: String(e)
                        };
                    }
                } finally {
                    frame.data.load = false;
                }
            };

            frame.functions.load();
            frame.functions.retry = (useCache = false) => {
                frame.functions.load(useCache);
            };
        };

        const renewPreviewSignal = (): AbortSignal => {
            this.memory.controller?.abort();

            const controller = new AbortController();
            this.memory.controller = controller;
            this.memory.signal = controller.signal;
            return controller.signal;
        };

        const newPostWithData = (preData: GalleryPreData, historySkip?: boolean) => {
            if (!frame) return;

            const bodyFrame = frame.frames[0];
            const commentFrame = frame.frames[1];

            if (bodyFrame.data.load) return;

            const signal = renewPreviewSignal();
            const params = new URLSearchParams(preData.link);
            params.set("no", preData.id);
            preData.link = decodeURIComponent(params.toString());

            preData.title = "로딩 중...";
            bodyFrame.contents = "로딩 중...";

            makeBodyFrame(bodyFrame, preData, signal, historySkip);
            makeCommentFrame(commentFrame, preData, signal);

            if (this.status.toggleAdminPanel && document.querySelector(".useradmin_btnbox button")) {
                panel.admin(preData, frame, this.status.toggleBlur, eventBus, this.status.useKeyPress, previewRequest);
            }
        };

        const previewFrame = (ev: MouseEvent | null, prd?: GalleryPreData, historySkip?: boolean) => {
            if (this.memory.preventOpen) {
                this.memory.preventOpen = false;

                return;
            }

            if ((ev?.target as HTMLElement)?.closest(".ub-writer")) {
                return;
            }

            if (this.status.tooltipMode) miniPreviewClose(miniPreview, this.status.tooltipMode);

            const preData = ev === null ? prd : getRelevantData(ev);

            if (!preData) return;
            currentPreData = preData;

            let collapseView = false;

            if (ev?.target instanceof HTMLElement) {
                collapseView = ev.target.className.includes("reply_num");
            }

            if (!historySkip) {
                this.memory.titleStore = document.title;
                this.memory.urlStore = location.href;
            }

            const signal = renewPreviewSignal();

            let appStore: PreviewFrameAppApi | undefined;
            let groupStore: HTMLElement;

            let scrolledCount = 0;

            if (!frame) {
                const detector = new ScrollDetection();

                frame = new Frame(
                    [
                        {
                            relative: true,
                            center: true,
                            preview: true,
                            blur: this.status.toggleBlur
                        },
                        {
                            relative: true,
                            center: true,
                            preview: true,
                            blur: this.status.toggleBlur
                        }
                    ],
                    {
                        background: true,
                        onScroll: (ev: WheelEvent, group: HTMLElement) => {
                            if (!this.status.scrollToSkip) return;

                            appStore = frame?.app;
                            groupStore = group;

                            detector.addMouseEvent(ev);
                        },
                        blur: this.status.toggleBackgroundBlur
                    }
                );

                detector.listen("scroll", (ev: WheelEvent) => {
                    const scrolledTop = groupStore.scrollTop === 0;

                    const scroll = Math.floor(groupStore.scrollHeight - groupStore.scrollTop);

                    const scrolledToBottom =
                        scroll === groupStore.clientHeight || scroll + 1 === groupStore.clientHeight;

                    if (!scrolledTop && !scrolledToBottom) {
                        scrolledCount = 0;
                    }

                    const getNextPost = (direction: "next" | "prev") => {
                        const post = document.querySelector(`.us-post[data-no="${postFetchedData.id}"]`) as HTMLElement | null;

                        if (!post) return;

                        const nextPost = direction === "next"
                            ? (post.previousElementSibling as HTMLElement | null)
                            : (post.nextElementSibling as HTMLElement | null);

                        if (!nextPost || nextPost.getAttribute("data-type") === "icon_notice") return;

                        const nextPostNo = nextPost.getAttribute("data-no");

                        if (!nextPostNo) return;

                        return nextPostNo;
                    };

                    if (ev.deltaY < 0) {
                        appStore?.setScrollMode("top");

                        if (!scrolledTop) {
                            appStore?.clearScrollMode();
                        }

                        if (!scrolledTop || !preData) return;

                        if (scrolledCount++ < 1) return;

                        scrolledCount = 0;

                        preData.id = getNextPost("prev") || (Number(postFetchedData.id) - 1).toString();

                        newPostWithData(preData, historySkip);
                        groupStore.scrollTop = 0;

                        appStore?.clearScrollMode();
                    } else {
                        appStore?.setScrollMode("bottom");

                        if (!scrolledToBottom) {
                            appStore?.clearScrollMode();
                        }

                        if (!scrolledToBottom || !preData) {
                            return;
                        }

                        if (scrolledCount++ < 1) return;

                        scrolledCount = 0;

                        preData.id = getNextPost("next") || (Number(postFetchedData.id) + 1).toString();
                        newPostWithData(preData, historySkip);

                        groupStore.scrollTop = 0;
                        appStore?.clearScrollMode();
                    }
                });

                const getAdjacentPostNo = (direction: "next" | "prev") => {
                    if (!postFetchedData?.id) return;

                    const post = document.querySelector(`.us-post[data-no="${postFetchedData.id}"]`) as HTMLElement | null;
                    if (!post) return;

                    const adjacentPost = direction === "next"
                        ? (post.previousElementSibling as HTMLElement | null)
                        : (post.nextElementSibling as HTMLElement | null);
                    if (!adjacentPost || adjacentPost.getAttribute("data-type") === "icon_notice") return;

                    return adjacentPost.getAttribute("data-no");
                };

                previewNavigationKeyDown = (keyboardEvent: KeyboardEvent) => {
                    if (keyboardEvent.key !== "PageUp" && keyboardEvent.key !== "PageDown") return;
                    if (!currentPreData || frame?.app?.closed || frame?.app?.inputFocus) return;

                    keyboardEvent.preventDefault();

                    const isPageUp = keyboardEvent.key === "PageUp";
                    const nextPostNo = isPageUp
                        ? getAdjacentPostNo("prev") || (Number(postFetchedData.id) - 1).toString()
                        : getAdjacentPostNo("next") || (Number(postFetchedData.id) + 1).toString();

                    currentPreData.id = nextPostNo;
                    newPostWithData(currentPreData, historySkip);

                    if (groupStore) {
                        groupStore.scrollTop = 0;
                    }

                    appStore?.clearScrollMode();
                };

                document.addEventListener("keydown", previewNavigationKeyDown);

                frame.app?.onClose(() => {
                    this.memory.controller?.abort();
                    this.memory.controller = null;
                    this.memory.signal = null;

                    const blockPopup = document.querySelector(".refresher-block-popup");
                    blockPopup?.remove();

                    const captchaPopup = document.querySelector(".refresher-captcha-popup");
                    captchaPopup?.remove();

                    const adminPanel = document.querySelector(".refresher-management-panel");
                    adminPanel?.remove();

                    removeAdminKeyPressHandler();
                    if (previewNavigationKeyDown) {
                        document.removeEventListener("keydown", previewNavigationKeyDown);
                        previewNavigationKeyDown = null;
                    }

                    if (!this.memory.historyClose && this.memory.titleStore) {
                        history.pushState(null, this.memory.titleStore, this.memory.urlStore);
                    }

                    this.memory.historyClose = false;

                    if (this.memory.titleStore) {
                        document.title = this.memory.titleStore;
                    }

                    appStore?.clearScrollMode();
                    window.clearInterval(this.memory.refreshIntervalId!);
                });
            }

            frame.app.closed = false;

            frame.frames[0].collapse = collapseView;

            makeBodyFrame(frame.frames[0], preData, signal, historySkip);

            makeCommentFrame(frame.frames[1], preData, signal);

            if (this.status.toggleAdminPanel && document.querySelector(".useradmin_btnbox button") !== null) {
                panel.admin(preData, frame, this.status.toggleBlur, eventBus, this.status.useKeyPress, previewRequest);
            }

            setTimeout(frame.app.fadeIn, 0);

            ev?.preventDefault();
        };

        const handleMousePress = (ev: MouseEvent) => {
            if (ev.button !== 2) return;

            if (ev.type === "mousedown") {
                this.memory.lastPress = Date.now();
                return;
            }

            if (
                ev.type === "mouseup" &&
                this.memory.lastPress > 0 &&
                Date.now() - this.status.longPressDelay > this.memory.lastPress
            ) {
                this.memory.preventOpen = true;
                this.memory.lastPress = 0;
            }
        };

        const addHandler = (element: HTMLElement) => {
            if (element.dataset.refresherPreview === "true") return;

            let timer: number | undefined;

            element.dataset.refresherPreview = "true";
            elementEventSignal.addEventListener("abort", () => {
                if (typeof timer === "number") {
                    window.clearTimeout(timer);
                }

                delete element.dataset.refresherPreview;
            }, {once: true});

            element.addEventListener("mouseup", handleMousePress, {signal: elementEventSignal});
            element.addEventListener("mousedown", handleMousePress, {signal: elementEventSignal});
            element.addEventListener(this.status.reversePreviewKey ? "click" : "contextmenu", (ev) => {
                if (element.closest(".us-post")?.classList.contains("refresherBlur")) return;

                if (typeof timer === "number") {
                    window.clearTimeout(timer);
                    timer = undefined;
                }

                previewFrame(ev);
            }, {signal: elementEventSignal});

            if (this.status.reversePreviewKey) {
                element.addEventListener("contextmenu", (e) => {
                    e.preventDefault();

                    const target = e.target as HTMLAnchorElement;

                    location.href =
                        target.getAttribute("href") ??
                        target.closest(".us-post")?.querySelector("a:not(.reply_numbox)")?.getAttribute("href") ??
                        location.href;
                }, {signal: elementEventSignal});
            }

            element.addEventListener("mouseenter", (ev) => {
                if (
                    !this.status.tooltipMode ||
                    element.closest(".us-post")?.classList.contains("refresherBlur") ||
                    typeof timer === "number" ||
                    (this.status.tooltipRatioDisable && element.closest(".us-post")?.querySelector(".ratio[style]"))
                )
                    return;

                timer = window.setTimeout(() => {
                    miniPreviewCreate(
                        miniPreview,
                        ev,
                        this.status.tooltipMode,
                        this.status.tooltipMediaHide,
                        this.status.tooltipInteraction,
                        getRelevantData,
                        postCaches,
                        previewRequest
                    );

                    if (this.status.tooltipInteraction)
                        miniPreviewMove(miniPreview, ev, this.status.tooltipMode, this.status.tooltipInteraction);
                }, this.status.tooltipDelay);
            }, {signal: elementEventSignal});

            element.addEventListener("mousemove", (ev) => {
                if (this.status.tooltipMode && !this.status.tooltipInteraction)
                    miniPreviewMove(miniPreview, ev, this.status.tooltipMode, this.status.tooltipInteraction);
            }, {signal: elementEventSignal});

            element.addEventListener("mouseleave", () => {
                if (!this.status.tooltipMode) return;

                if (typeof timer === "number") {
                    window.clearTimeout(timer);
                    timer = undefined;
                }

                miniPreviewClose(miniPreview, this.status.tooltipMode);
            }, {signal: elementEventSignal});
        };

        this.memory.uuid = filter.add(
            `.gall_list .ub-content${this.status.expandRecognizeRange ? "" : " .ub-word"}`,
            addHandler,
            {neverExpire: true}
        );

        this.memory.popStateHandler = (ev: PopStateEvent) => {
            if (!ev.state) {
                this.memory.historyClose = true;

                try {
                    frame?.app?.close();
                } catch {
                    location.reload();
                }

                return;
            }

            this.memory.historyClose = false;

            if (frame?.app?.closed) {
                previewFrame(null, ev.state.preData, true);
            } else {
                newPostWithData(ev.state.preData, true);
            }
        };

        window.addEventListener("popstate", this.memory.popStateHandler);
    },
    revoke() {
        if (this.memory.uuid) filter.remove(this.memory.uuid, true);
        this.memory.uuid = null;

        if (this.memory.cacheButtonFilterId) {
            filter.remove(this.memory.cacheButtonFilterId, true);
            this.memory.cacheButtonFilterId = null;
        }

        if (this.memory.newPostListEvent) {
            eventBus.remove("newPostList", this.memory.newPostListEvent, true);
            this.memory.newPostListEvent = null;
        }

        if (this.memory.popStateHandler) {
            window.removeEventListener("popstate", this.memory.popStateHandler);
            this.memory.popStateHandler = null;
        }

        if (this.memory.imageBlockClickHandler) {
            document.removeEventListener("click", this.memory.imageBlockClickHandler);
            this.memory.imageBlockClickHandler = null;
        }

        if (previewNavigationKeyDown) {
            document.removeEventListener("keydown", previewNavigationKeyDown);
            previewNavigationKeyDown = null;
        }

        removeAdminKeyPressHandler();

        if (this.memory.refreshIntervalId) {
            window.clearInterval(this.memory.refreshIntervalId);
            this.memory.refreshIntervalId = null;
        }

        this.memory.controller?.abort();
        this.memory.controller = null;
        this.memory.signal = null;
        this.memory.elementEventController?.abort();
        this.memory.elementEventController = null;

        if (frame) {
            frame.destroy();
            frame = undefined;
        }
    }
} as RefresherModule<{
    memory: {
        preventOpen: boolean;
        lastPress: number;
        uuid: string | null;
        popStateHandler: ((ev: PopStateEvent) => void) | null;
        signal: AbortSignal | null;
        controller: AbortController | null;
        historyClose: boolean;
        titleStore: string | null;
        urlStore: string | null;
        refreshIntervalId: number | null;
        newPostListEvent: string | null;
        cacheButtonFilterId: string | null;
        imageBlockClickHandler: ((event: MouseEvent) => void) | null;
        elementEventController: AbortController | null;
    };
    settings: {
        tooltipMode: RefresherCheckSettings;
        tooltipMediaHide: RefresherCheckSettings;
        tooltipDelay: RefresherRangeSettings;
        tooltipInteraction: RefresherCheckSettings;
        tooltipRatioDisable: RefresherCheckSettings;
        reversePreviewKey: RefresherCheckSettings;
        longPressDelay: RefresherRangeSettings;
        scrollToSkip: RefresherCheckSettings;
        colorPreviewLink: RefresherCheckSettings;
        autoRefreshComment: RefresherCheckSettings;
        commentRefreshInterval: RefresherRangeSettings;
        toggleBlur: RefresherCheckSettings;
        toggleBackgroundBlur: RefresherCheckSettings;
        toggleAdminPanel: RefresherCheckSettings;
        useKeyPress: RefresherCheckSettings;
        blockPresetDay: RefresherOptionSettings;
        blockPresetReason: RefresherTextSettings;
        blockPresetDelete: RefresherCheckSettings;
        blockPresetUserType: RefresherCheckSettings;
        expandRecognizeRange: RefresherCheckSettings;
        experimentalComment: RefresherCheckSettings;
        disableCache: RefresherCheckSettings;
        archiveArticle: RefresherCheckSettings;
        newArticleArchive: RefresherCheckSettings;
        blockImage: RefresherCheckSettings;
    };
}>;