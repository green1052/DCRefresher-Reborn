import type {PreviewFrame} from "./previewFrame";
import * as block from "@/core/block";
import eventBus from "@/core/eventbus";
import {panel} from "./panel";
import * as http from "@/http/http";
import {previewRequest} from "./request";
import {PostCache} from "./cache";
import toast from "@/utils/toast";

export interface PostFetchedDataRef {
    value: IPostInfo | undefined;
}

export interface BodyFrameContext {
    frame: PreviewFrame;
    preData: GalleryPreData;
    signal: AbortSignal;
    historySkip?: boolean;
    gallery: string | undefined;
    disableCache: boolean;
    colorPreviewLink: boolean;
    gifControl: boolean;
    blockImage: boolean;
    postCaches: PostCache;
    postFetchedDataRef: PostFetchedDataRef;
    getGroupElement: () => HTMLElement | undefined;
}

export function makeBodyFrame(ctx: BodyFrameContext): void {
    const {
        frame,
        preData,
        signal,
        historySkip,
        gallery,
        disableCache,
        colorPreviewLink,
        gifControl,
        blockImage,
        postCaches,
        postFetchedDataRef
    } = ctx;

    frame.data.load = true;
    frame.title = preData.title!;
    frame.data.buttons = true;
    frame.data.type = preData.type!;
    frame.data.useImageBlock = blockImage;

    if (colorPreviewLink) {
        const title = `${preData.title} - ${document.title.split("-").slice(-1)[0].trim()}`;

        if (!historySkip) {
            history.pushState({preData, preURL: location.href}, title, preData.link);
        }

        document.title = title;
    }

    const getPostInfo = async (useCache: boolean): Promise<IPostInfo> => {
        const cacheKey = PostCache.key(preData.gallery, preData.id);

        if (useCache && !disableCache) {
            const cache = postCaches.get(cacheKey);

            if (cache?.post !== undefined) {
                return cache.post as IPostInfo;
            }
        }

        const response = await previewRequest.post(preData.link!, preData.gallery, preData.id, signal);

        if (!response) throw new Error("Can not fetch post data.");

        postCaches.set(cacheKey, {
            date: Date.now(),
            post: response
        });

        return response as IPostInfo;
    };

    const renderPostContent = (postInfo: IPostInfo): void => {
        if (postInfo.isAdult) {
            frame.error = {
                title: "성인 인증이 필요한 게시글입니다.",
                detail: "성인 인증을 하신 후 다시 시도해주세요."
            };
            return;
        }

        const dom = new DOMParser().parseFromString(postInfo.contents!, "text/html");

        for (const element of dom.querySelectorAll("img[data-original]")) {
            element.setAttribute("src", element.getAttribute("data-original")!);
        }

        if (gifControl) {
            for (const element of dom.querySelectorAll("video")) {
                const src = element.getAttribute("data-src");

                if (src?.includes("dcinside.com/dccon.php")) continue;

                element.removeAttribute("onmousedown");
                element.setAttribute("controls", "");
            }
        }

        frame.contents = block.check("TEXT", dom.body.innerHTML, gallery)
            ? "게시글 내용이 차단됐습니다."
            : dom.body.innerHTML;

        frame.upvotes = postInfo.upvotes;
        frame.fixedUpvotes = postInfo.fixedUpvotes;
        frame.downvotes = postInfo.downvotes;

        if (frame.title !== postInfo.title) frame.title = postInfo.title!;

        frame.data.disabledDownvote = postInfo.disabledDownvote ?? false;
        frame.data.user = postInfo.user;

        if (postInfo.date) {
            frame.data.date = new Date(postInfo.date.replace(/\./g, "-"));
        }

        if (postInfo.expire) {
            frame.data.expire = new Date(postInfo.expire);
        }

        frame.data.buttons = true;
        frame.data.views = `조회 ${postInfo.views}회`;
    };

    frame.functions.vote = async (type: number) => {
        if (frame.collapse) {
            toast.show("댓글 보기를 클릭하여 댓글만 표시합니다.");
            return false;
        }

        if (!postFetchedDataRef.value) {
            toast.show("게시글이 로딩될 때까지 잠시 기다려주세요.");
            return false;
        }

        const postFetched = postFetchedDataRef.value;

        const codeSrc = postFetched.requireCaptcha
            ? await previewRequest.captcha(preData, "recommend")
            : undefined;

        const req = async (captcha?: string) => {
            const response = await previewRequest.vote(
                preData.gallery,
                preData.id,
                type,
                captcha ?? undefined,
                preData.link!,
                postFetched.v_cur_t,
                postFetched.randomParam
            );

            if (response.result === "true") {
                frame[type ? "upvotes" : "downvotes"] = response.counts.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                return true;
            }

            toast.show(response.counts, "error");
            return false;
        };

        return codeSrc ? panel.captcha(codeSrc, req) : req();
    };

    frame.functions.share = async () => {
        await navigator.clipboard.writeText(`https://gall.dcinside.com/${http.galleryType(preData.link!, "/")}board/view/?id=${preData.gallery || http.queryString("id")}&no=${preData.id}`)
            .then(() => toast.show("클립보드에 복사되었습니다."))
            .catch(() => toast.show("클립보드에 복사하는데 실패했습니다.", "error"));

        return true;
    };

    frame.functions.load = async (useCache = true) => {
        frame.data.load = true;
        frame.error = undefined;

        try {
            const postInfo = await getPostInfo(useCache);
            postFetchedDataRef.value = postInfo;

            if (colorPreviewLink) {
                const title = `${postInfo.title} - ${document.title.split("-").slice(-1)[0].trim()}`;

                if (!historySkip) {
                    preData.title = postInfo.title;
                    history.replaceState({preData, preURL: location.href}, title, preData.link);
                }

                document.title = title;
            }

            try {
                renderPostContent(postInfo);
            } finally {
                eventBus.emit("RefresherPostDataLoaded", postInfo);
                eventBus.emit("RefresherPostCommentIDLoaded", postInfo.commentId, postInfo.commentNo);
                eventBus.emitNextTick("contentPreview", ctx.getGroupElement()!);
            }
        } catch (error) {
            frame.error = {
                title: "게시글",
                detail: String(error)
            };

            console.error("Error occured while loading a post.", error);
        } finally {
            frame.data.load = false;
        }
    };

    frame.functions.retry = (useCache = false) => {
        frame.functions.load(useCache);
    };

    if (!frame.collapse) frame.functions.load();

    frame.functions.openOriginal = async () => {
        if (colorPreviewLink) location.reload();
        else location.href = preData.link!;

        return true;
    };
}