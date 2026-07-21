import eventBus from "@/core/eventbus";
import {submitComment} from "@/utils/comment";
import {panel} from "./panel";
import {previewRequest} from "./request";
import toast from "@/utils/toast";
import type {PostFetchedDataRef} from "./bodyFrame";

// grecaptcha 토큰 획득 (3초 타임아웃)
export function getGrecaptchaToken(): Promise<string | undefined> {
    return new Promise<string | undefined>((resolve) => {
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
}

// 댓글 작성 함수 생성
export function createWriteComment(
    preData: GalleryPreData,
    postDom: Document,
    postFetchedDataRef: PostFetchedDataRef,
    signal: AbortSignal
) {
    return async (
        type: "text" | "dccon",
        memo: string | DcinsideDccon[],
        commentNo: string | null,
        replyNo: string | null,
        user: { name: string; pw?: string },
        bigDccon: boolean
    ): Promise<boolean> => {
        if (!postFetchedDataRef.value) {
            toast.show("게시글이 로딩될 때까지 잠시 기다려주세요.", "error");
            return false;
        }

        const requireCapCode = postFetchedDataRef.value.requireCommentCaptcha;
        const codeSrc = requireCapCode ? await previewRequest.captcha(preData, "comment") : undefined;
        const grecaptcha = await getGrecaptchaToken();

        const req = async (captcha?: string) => {
            const postData: GalleryPreData = {
                gallery: postFetchedDataRef.value?.commentId ?? "",
                id: postFetchedDataRef.value?.commentNo ?? "",
                type: ""
            };

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
            }

            return true;
        };

        return codeSrc ? await panel.captcha(codeSrc, req) : req();
    };
}

// RefresherPostCommentIDLoaded 이벤트 대기
export function waitForCommentIdLoaded(signal: AbortSignal): Promise<GalleryPreData | null> {
    return new Promise<GalleryPreData | null>((resolve) => {
        let eventId: (() => void) | null = null;

        const abortHandler = () => {
            if (eventId) {
                eventId();
            }
            resolve(null);
        };

        eventId = eventBus.on(
            "RefresherPostCommentIDLoaded",
            (commentId, commentNo) => {
                signal.removeEventListener("abort", abortHandler);
                resolve({
                    gallery: commentId ?? "",
                    id: commentNo ?? "",
                    type: ""
                });
            },
            {once: true}
        );

        signal.addEventListener("abort", abortHandler, {once: true});
    });
}