/** 확장 페이지 주소. 확장 페이지는 크로미엄에서만 연다 (플레이라이트의 파이어폭스는 moz-extension:// 페이지로 이동하지 못한다). */
export const extensionUrl = (extensionId: string, file: string): string => `chrome-extension://${extensionId}/${file}`;
