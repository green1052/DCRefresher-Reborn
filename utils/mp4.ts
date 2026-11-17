/** mp4 파일 전체인지: 첫 상자가 ftyp이고 상자 크기 합이 길이와 같다. Range로 일부만 온 움짤을 걸른다. */
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
