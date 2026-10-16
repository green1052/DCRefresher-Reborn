/**
 * 받은 바이트가 mp4 파일 전체인지: 첫 상자가 ftyp이고, 최상위 상자 크기를 이어 더하면 받은 길이와 같다.
 * 움짤은 구간 요청(Range)으로 받아 파일 일부만 오기도 한다. 그것을 파일로 해시하지 않으려고 본다
 * (파이어폭스 배경의 응답 필터, 크롬이 캐시에서 주는 206).
 * 상자 경계에서 딱 잘린 일부는 통과하지만, 그때는 그 주소의 해시가 틀릴 뿐이다.
 */
export const isWholeMp4 = (bytes: Uint8Array): boolean => {
    if (bytes.length < 8 || String.fromCharCode(...bytes.subarray(4, 8)) !== "ftyp") return false;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 0;
    while (offset + 8 <= bytes.length) {
        let size = view.getUint32(offset);
        // 1이면 뒤의 8바이트가 크기다. 0이면 파일 끝까지다.
        if (size === 1) {
            if (offset + 16 > bytes.length) return false;
            size = Number(view.getBigUint64(offset + 8));
        } else if (size === 0) {
            return true;
        }
        if (size < 8) return false;
        offset += size;
    }
    return offset === bytes.length;
};
