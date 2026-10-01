/** 배열이 아닌 객체인지. 저장값·JSON처럼 모양을 모르는 값의 속성을 unknown으로 읽게 좁힌다. */
export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
