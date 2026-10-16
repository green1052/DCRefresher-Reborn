/** SHA-256 (16진수 소문자). 클라우드 백업의 무결성 확인과 이미지 차단 항목이 쓴다. */
export const sha256 = async (data: BufferSource): Promise<string> =>
    new Uint8Array(await crypto.subtle.digest("SHA-256", data)).toHex();
