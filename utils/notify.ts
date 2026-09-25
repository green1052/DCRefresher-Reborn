import type {ManageResult} from "@/core/preview/request";
import {useUiStore} from "@/stores/ui";

/** 관리 결과 알림 — 디시가 준 문구가 있으면 그대로, 없으면 기본 문구. 성공 여부를 돌려준다 */
export const notifyManage = (result: ManageResult, done: string): boolean => {
    useUiStore.getState().showToast(result.message ?? (result.success ? done : "처리하지 못했습니다."), result.success ? "info" : "error");
    return result.success;
};
