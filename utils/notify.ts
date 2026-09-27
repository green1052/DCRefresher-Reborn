import type {ManageResult} from "@/core/preview/request";
import {useUiStore} from "@/stores/ui";

/** 관리 결과를 토스트로 알리고 성공 여부를 돌려준다. 디시가 준 문구가 있으면 그 문구를 우선한다 */
export const notifyManage = (result: ManageResult, done: string): boolean => {
    useUiStore.getState().showToast(result.message ?? (result.success ? done : "처리하지 못했습니다."), result.success ? "info" : "error");
    return result.success;
};
