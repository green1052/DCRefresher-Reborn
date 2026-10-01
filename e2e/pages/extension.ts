/**
 * 확장 페이지 주소. 크로미엄은 chrome-extension://<32자 id>, 파이어폭스는 moz-extension://<UUID>다 (e2e/firefox.ts).
 * extensionId 모양으로 가린다.
 */
export const extensionUrl = (extensionId: string, file: string): string =>
    `${extensionId.includes("-") ? "moz-extension" : "chrome-extension"}://${extensionId}/${file}`;
