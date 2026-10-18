import type {ManageResult} from "@/core/preview/request";
import {isBlockedError} from "@/utils/error";

import {useUiStore} from "./ui";

/** 원인은 콘솔에 남기고 정해진 문구(message)를 오류 토스트로 띄운다. 임시 차단은 HTTP 클라이언트가 이미 알렸으므로 덮지 않는다. */
export const reportFailure = (e: unknown, label: string, message: string): void => {
    if (isBlockedError(e)) return;
    console.error(label, e);
    useUiStore.getState().showToast(message, "error");
};

/**
 * 관리 요청을 기다려 결과를 토스트로 알리고 성공했는지 돌려준다. 디시가 준 문구가 있으면 그 문구를 우선한다.
 * 요청이 실패하면 failure를 띄운다 (reportFailure).
 */
export const notifyManage = async (request: Promise<ManageResult>, done: string, failure: string): Promise<boolean> => {
    try {
        const result = await request;
        // 디시가 문구 없이 실패를 주는 것은 대개 로그인이 풀렸거나 권한이 없을 때다 (세션이 끊기면 HTML이 온다).
        useUiStore.getState().showToast(result.message ?? (result.success ? done : "처리하지 못했습니다. 로그인과 권한을 확인한 뒤 다시 시도해 주세요."), result.success ? "info" : "error");
        return result.success;
    } catch (e) {
        reportFailure(e, "Manage request failed:", failure);
        return false;
    }
};
