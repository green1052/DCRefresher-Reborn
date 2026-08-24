import eventBus from "@/core/eventbus";
import {submitComment} from "@/utils/comment";
import {requestWithCaptcha} from "./panel";
import {previewRequest} from "./request";
import toast from "@/utils/toast";
import type {PreviewFrame} from "./frame";
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

        // 캡차 팝업과 병렬로 토큰(최대 3초)을 미리 받아둔다
        const grecaptchaPromise = getGrecaptchaToken();

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
                await grecaptchaPromise
            );

            if (res.result === "false" || res.result === "PreNotWorking") {
                toast.show(res.message!, "error");
                return false;
            }

            return true;
        };

        return requestWithCaptcha(
            preData,
            "comment",
            postFetchedDataRef.value.requireCommentCaptcha ?? false,
            req
        );
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

// 댓글 삭제 버튼 연속 클릭 방지용 타이머
const deletePressCount: Record<string, number> = {};

// 댓글 삭제 처리
export function handleDeleteComment(
    preData: GalleryPreData,
    commentId: string,
    password: string,
    admin: boolean,
    signal: AbortSignal,
    frame: PreviewFrame
): Promise<boolean> {
    if (!preData.link) return Promise.resolve(false);

    // 비밀번호 없을 시 2회 연속 클릭 체크
    if (!password) {
        if (deletePressCount[commentId] + 1000 < Date.now()) {
            deletePressCount[commentId] = 0;
        }

        if (!deletePressCount[commentId]) {
            toast.show("한번 더 누르면 댓글을 삭제합니다.", "warning", 1000);
            deletePressCount[commentId] = Date.now();
            return Promise.resolve(false);
        }

        deletePressCount[commentId] = 0;
    }

    return (
        admin && !password
            ? previewRequest.adminDeleteComment(preData, commentId, signal)
            : previewRequest.userDeleteComment(preData, commentId, signal, password)
    )
        .then((v) => {
            if (typeof v === "boolean") return v;

            if (v.includes("||")) {
                const [result, msg] = v.split("||");
                if (result !== "true") {
                    toast.show(msg, "error");
                    return false;
                }
            } else if (v[0] !== "{") {
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
}
