import * as http from "@/http/http";
import {previewRequest} from "./request";
import toast from "@/utils/toast";
import type {PreviewFrame} from "./previewFrame";

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

    const typeName = http.galleryTypeName(preData.link);
    if (!typeName.length) return Promise.resolve(false);

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
}