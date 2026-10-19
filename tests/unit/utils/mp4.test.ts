import {describe, expect, it} from "vitest";

import {isWholeMp4} from "@/utils/mp4";

/** 크기(4바이트)와 이름으로 상자 하나를 만든다. */
const box = (name: string, size: number): number[] => [size >>> 24, (size >>> 16) & 0xff, (size >>> 8) & 0xff, size & 0xff, ...[...name].map((c) => c.charCodeAt(0)), ...Array(size - 8).fill(0)];

describe("isWholeMp4", () => {
    const file = Uint8Array.from([...box("ftyp", 24), ...box("moov", 40), ...box("mdat", 100)]);

    it("최상위 상자 크기의 합이 받은 길이와 같으면 파일 전체다", () => {
        expect(isWholeMp4(file)).toBe(true);
    });

    it("잘린 본문과 중간부터 받은 구간(Range)은 아니다", () => {
        expect(isWholeMp4(file.subarray(0, 120))).toBe(false);
        expect(isWholeMp4(file.subarray(64))).toBe(false);
        expect(isWholeMp4(new Uint8Array())).toBe(false);
    });

    it("크기 0(파일 끝까지)과 64비트 크기를 따른다", () => {
        expect(isWholeMp4(Uint8Array.from([...box("ftyp", 24), 0, 0, 0, 0, ...[..."mdat"].map((c) => c.charCodeAt(0)), 1, 2, 3]))).toBe(true);
        const large = [0, 0, 0, 1, ...[..."mdat"].map((c) => c.charCodeAt(0)), 0, 0, 0, 0, 0, 0, 0, 20, 9, 9, 9, 9];
        expect(isWholeMp4(Uint8Array.from([...box("ftyp", 24), ...large]))).toBe(true);
        expect(isWholeMp4(Uint8Array.from([...box("ftyp", 24), ...large.slice(0, 18)]))).toBe(false);
    });
});
