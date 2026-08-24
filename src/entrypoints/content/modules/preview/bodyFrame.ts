import type {PreviewFrame} from "./frame";
import * as block from "@/core/block";
import eventBus from "@/core/eventbus";
import {requestWithCaptcha} from "./panel";
import * as http from "@/http/http";
import {fetchPostWithCache, previewRequest} from "./request";
import {restoreImageSources} from "./postParser";
import {PostCache} from "./cache";
import toast from "@/utils/toast";
import {enableVideoControls} from "@/utils/video";

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

// 게시글 콘텐츠 렌더링 (이미지/GIF 처리, 차단 체크, 필드 할당)
function renderPostContent(
    frame: PreviewFrame,
    postInfo: IPostInfo,
    gallery: string | undefined,
    gifControl: boolean
): void {
    if (postInfo.isAdult) {
        frame.patch({
            error: {
                title: "성인 인증이 필요한 게시글입니다.",
                detail: "성인 인증을 하신 후 다시 시도해주세요."
            }
        });
        return;
    }

    const dom = new DOMParser().parseFromString(postInfo.contents!, "text/html");

    restoreImageSources(dom);

    for (const img of dom.querySelectorAll("img, video")) {
        img.removeAttribute("style");
    }

    if (gifControl) {
        for (const video of dom.querySelectorAll<HTMLVideoElement>("video")) {
            enableVideoControls(video);
        }
    }

    frame.patch({
        contents: block.check("TEXT", dom.body.innerHTML, gallery)
            ? "게시글 내용이 차단됐습니다."
            : dom.body.innerHTML,
        upvotes: postInfo.upvotes,
        fixedUpvotes: postInfo.fixedUpvotes,
        downvotes: postInfo.downvotes,
        ...(frame.title !== postInfo.title ? {title: postInfo.title!} : {})
    });

    frame.patchData({
        disabledDownvote: postInfo.disabledDownvote ?? false,
        user: postInfo.user,
        ...(postInfo.date ? {date: new Date(postInfo.date.replace(/\./g, "-"))} : {}),
        ...(postInfo.expire ? {expire: new Date(postInfo.expire)} : {}),
        buttons: true,
        ...(postInfo.views !== undefined ? {views: `조회 ${postInfo.views}회`} : {})
    });
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

    frame.patchData({load: true, buttons: true, type: preData.type!, useImageBlock: blockImage});
    frame.patch({title: preData.title!});

    if (colorPreviewLink) {
        const title = `${preData.title} - ${document.title.split("-").slice(-1)[0].trim()}`;

        if (!historySkip) {
            history.pushState({preData, preURL: location.href}, title, preData.link);
        }

        document.title = title;
    }

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
                frame.patch(type ? {upvotes: response.counts.replace(/\B(?=(\d{3})+(?!\d))/g, ",")} : {downvotes: response.counts.replace(/\B(?=(\d{3})+(?!\d))/g, ",")});
                return true;
            }

            toast.show(response.counts, "error");
            return false;
        };

        return requestWithCaptcha(preData, "recommend", postFetched.requireCaptcha ?? false, req);
    };

    frame.functions.share = async () => {
        await navigator.clipboard.writeText(`https://gall.dcinside.com/${http.galleryType(preData.link!, "/")}board/view/?id=${preData.gallery || http.queryString("id")}&no=${preData.id}`)
            .then(() => toast.show("클립보드에 복사되었습니다."))
            .catch(() => toast.show("클립보드에 복사하는데 실패했습니다.", "error"));

        return true;
    };

    frame.functions.load = async (useCache = true) => {
        frame.patchData({load: true});
        frame.patch({error: undefined});

        try {
            const postInfo = await fetchPostWithCache(postCaches, preData, signal, useCache && !disableCache);
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
                renderPostContent(frame, postInfo, gallery, gifControl);
            } finally {
                eventBus.emit("RefresherPostDataLoaded", postInfo);
                eventBus.emit("RefresherPostCommentIDLoaded", postInfo.commentId, postInfo.commentNo);
                eventBus.emitNextTick("contentPreview", ctx.getGroupElement()!);
            }
        } catch (error) {
            frame.patch({
                error: {
                    title: "게시글",
                    detail: String(error)
                }
            });

            console.error("Error occured while loading a post.", error);
        } finally {
            frame.patchData({load: false});
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