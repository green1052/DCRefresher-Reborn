import {BlockedError} from "@/core/http/client";
import type {ManageResult} from "@/core/preview/request";
import {useUiStore} from "./ui";

/**
 * 관리 요청을 기다려 결과를 토스트로 알리고 성공 여부를 돌려준다. 디시가 준 문구가 있으면 그 문구를 우선한다.
 * 요청이 실패하면 failure를 띄운다. 임시 차단은 HTTP 클라이언트가 이미 알렸으니 덮어쓰지 않는다.
 */
export const notifyManage = async (request: Promise<ManageResult>, done: string, failure: string): Promise<boolean> => {
    const {showToast} = useUiStore.getState();
    try {
        const result = await request;
        // 디시가 문구 없이 실패를 주는 것은 대개 로그인이 풀렸거나 권한이 없을 때다 (세션이 끊기면 HTML이 온다).
        showToast(result.message ?? (result.success ? done : "처리하지 못했습니다. 로그인과 권한을 확인한 뒤 다시 시도해 주세요."), result.success ? "info" : "error");
        return result.success;
    } catch (e) {
        if (!(e instanceof BlockedError)) showToast(failure, "error");
        return false;
    }
};
