import {describe, expect, it} from "vitest";

import {fingerprintsOf, isSimilar} from "@/utils/imageFingerprint";

const image = (width: number, height: number, pixel: (x: number, y: number) => [number, number, number]): Uint8ClampedArray => {
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) rgba.set([...pixel(i % width, Math.floor(i / width)), 255], i * 4);
    return rgba;
};

describe("fingerprintsOf", () => {
    it("기준을 정할 때 잰 구현과 같은 지문을 낸다", () => {
        const rgba = image(64, 48, (x, y) => [128 + 100 * Math.sin(x / 5) * Math.cos(y / 7), (x * 3 + y * 2) % 256, 255 - x * 2]);
        expect(fingerprintsOf(rgba, 64, 48)).toEqual(["99bde7e7e7fe9898952a50ab5635ea75", "664218181880e6e6c07f05ff0360ff40"]);
    });

    it("오른쪽으로 밝아지면 dHash가 모두 1이고, 좌우 반전본은 모두 0이다", () => {
        const [fingerprint, mirrored] = fingerprintsOf(image(90, 80, (x) => [x * 2, x * 2, x * 2]), 90, 80);
        expect(fingerprint.slice(0, 16)).toBe("f".repeat(16));
        expect(mirrored.slice(0, 16)).toBe("0".repeat(16));
    });
});

describe("isSimilar", () => {
    const zero = "0".repeat(32);

    it("dHash와 pHash가 모두 기준 안이어야 비슷하다", () => {
        // 앞 64비트(dHash)만 4비트 다르다.
        expect(isSimilar(zero, `f${"0".repeat(31)}`, 4)).toBe(true);
        expect(isSimilar(zero, `f${"0".repeat(31)}`, 3)).toBe(false);
        // 둘 다 4비트씩 다르다.
        expect(isSimilar(zero, `${"0".repeat(15)}f${"0".repeat(15)}f`, 4)).toBe(true);
        // 32비트 경계의 맨 위 비트(부호)도 센다.
        expect(isSimilar(zero, `${"0".repeat(16)}ffffffff${"0".repeat(8)}`, 31)).toBe(false);
    });
});
