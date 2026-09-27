/**
 * 오류의 메시지. 파이어폭스 content.fetch의 오류는 페이지 영역의 DOMException이라 instanceof Error가 거짓이다.
 * 그래서 메시지는 모양으로 꺼낸다
 */
export const messageOf = (error: unknown): string =>
    typeof error === "object" && error !== null && "message" in error && typeof error.message === "string" ? error.message : String(error);
