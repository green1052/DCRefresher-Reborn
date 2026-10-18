/** SHA-256 (16진수 소문자). 클라우드 백업의 무결성 확인과 이미지 차단 항목이 쓴다. */
export const sha256 = async (data: BufferSource): Promise<string> =>
    new Uint8Array(await crypto.subtle.digest("SHA-256", data)).toHex();

/**
 * 빠른 53비트 문자열 해시(cyrb53). 암호용이 아니다. 긴 문자열을 들고 있지 않고 같은지만 견줄 때 쓴다.
 * 동기라 DOM을 고치는 흐름 안에서 바로 쓸 수 있다 (sha256은 비동기다).
 */
export const hash53 = (text: string): number => {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let index = 0; index < text.length; index++) {
        const code = text.charCodeAt(index);
        h1 = Math.imul(h1 ^ code, 2654435761);
        h2 = Math.imul(h2 ^ code, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};
