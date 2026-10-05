import {isHTTPError, isNetworkError, isTimeoutError} from "ky";

/** 오류의 메시지. 파이어폭스 content.fetch의 오류는 페이지 영역의 DOMException이라 instanceof Error가 거짓이므로 모양으로 꺼낸다. */
export const messageOf = (error: unknown): string =>
    typeof error === "object" && error !== null && "message" in error && typeof error.message === "string" ? error.message : String(error);

/** 스토어가 저장소 쓰기에 실패해 되돌렸을 때의 안내. 확장을 업데이트한 뒤 남은 옛 탭에서 주로 난다. */
export const SAVE_FAILED = "저장하지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.";

/** 스토어가 화면에 먼저 반영한 값을 저장한다. 저장이 실패하면 reload로 저장소 값으로 되돌려 저장된 것처럼 보이지 않게 하고, 알림은 부른 쪽에 맡긴다. */
export const saveOrReload = async (write: Promise<void>, reload: () => Promise<void>, label: string): Promise<void> => {
    try {
        await write;
    } catch (e) {
        console.error(label, e);
        await reload().catch(console.error);
        throw e;
    }
};

/**
 * 화면에 보일 오류 문구. 브라우저·ky의 원문(영어, 요청 주소 포함)은 console.error에 남기고 사용자에게는 이것을 보인다.
 * 우리가 던진 오류는 이미 한국어 안내라 그대로 쓴다.
 */
export const friendlyMessage = (error: unknown): string => {
    const message = messageOf(error);
    if (isHTTPError(error)) {
        const {status} = error.response;
        if (status === 403 || status === 429) return "요청이 많아 잠시 막혔습니다. 잠시 후 다시 시도해 주세요.";
        return status >= 500 ? "서버가 불안정합니다. 잠시 후 다시 시도해 주세요." : `요청이 거절되었습니다. (HTTP ${status})`;
    }
    // 요청 시간 제한(core/http/client.ts)의 DOMException도 이름이 TimeoutError다.
    if (isTimeoutError(error)) return "응답이 없습니다. 잠시 후 다시 시도해 주세요.";
    if (isNetworkError(error) || /failed to fetch|networkerror/i.test(message)) return "서버에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.";
    if (error instanceof SyntaxError) return "JSON 형식이 올바르지 않습니다.";
    // storage.sync의 쓰기 횟수 한도(MAX_WRITE_OPERATIONS_PER_MINUTE 등)와 용량 한도(QUOTA_BYTES 등).
    if (message.includes("MAX_WRITE_OPERATIONS")) return "짧은 시간에 너무 자주 저장했습니다. 잠시 후 다시 시도해 주세요.";
    if (/quota/i.test(message)) return "저장 공간이 부족합니다.";
    return /[가-힣]/.test(message) ? message : "잠시 후 다시 시도해 주세요.";
};
