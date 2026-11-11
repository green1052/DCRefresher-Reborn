import {beforeAll, describe, expect, it, vi} from "vitest";

import {fingerprintsOf, imageFingerprints, isSimilar} from "@/utils/imageFingerprint";

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

describe("imageFingerprints", () => {
    const WIDTH = 64;
    const HEIGHT = 48;
    // 그린 것(프레임, 비트맵)이 그대로 내놓을 화소. 오른쪽으로 밝아지면 dHash가 모두 1, 왼쪽으로 밝아지면 모두 0이다.
    const PATTERNS = {
        right: image(WIDTH, HEIGHT, (x) => [x * 4, x * 4, x * 4]),
        left: image(WIDTH, HEIGHT, (x) => [255 - x * 4, 255 - x * 4, 255 - x * 4]),
        flat: image(WIDTH, HEIGHT, () => [0, 0, 0])
    };
    type Pattern = keyof typeof PATTERNS;
    const drawable = (pattern: Pattern) => ({rgba: PATTERNS[pattern], width: WIDTH, height: HEIGHT, displayWidth: WIDTH, displayHeight: HEIGHT, close: () => {}});

    /** 움짤 프레임: [길이(초), 화소]. ImageDecoder는 시각을 마이크로초로 준다. */
    let frames: [number, Pattern][] = [];
    let decodedType = "";
    /** 그린 것을 닫은 때와 캔버스를 읽은 때의 순서. */
    let events: string[] = [];

    class FakeImageDecoder {
        completed = Promise.resolve();
        tracks = {ready: Promise.resolve(), selectedTrack: {frameCount: frames.length}};

        constructor({type}: { type: string }) {
            decodedType = type;
        }

        decode = async ({frameIndex}: { frameIndex: number }) => {
            const start = frames.slice(0, frameIndex).reduce((sum, [length]) => sum + length, 0);
            const [length, pattern] = frames[frameIndex]!;
            return {image: {...drawable(pattern), timestamp: start * 1e6, duration: length * 1e6}};
        };

        close = () => {};
    }

    class FakeOffscreenCanvas {
        getContext = () => {
            let drawn: Uint8ClampedArray | undefined;
            return {fillRect: () => {}, drawImage: (source: { rgba: Uint8ClampedArray }) => (drawn = source.rgba), getImageData: () => {
                events.push("read");
                return {data: drawn};
            }};
        };
    }

    /** 문서에 붙이지 않은 <img>로 화소 수만 읽는다 (pixelsOf). */
    class FakeImage {
        naturalWidth = WIDTH;
        naturalHeight = HEIGHT;
        onload?: () => void;

        set src(_: string) {
            queueMicrotask(() => this.onload?.());
        }
    }

    const file = (head: string): Blob => new Blob([head, new Uint8Array(16)]);
    const dHashes = (samples: [string, string][] | undefined): string[] | undefined => samples?.map(([fingerprint]) => fingerprint.slice(0, 16));

    beforeAll(() => {
        // jsdom의 Blob에는 arrayBuffer가 없다.
        Blob.prototype.arrayBuffer ??= function (this: Blob) {
            return new Promise<ArrayBuffer>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => (reader.result !== null && typeof reader.result !== "string" ? resolve(reader.result) : reject(new Error("읽기 실패")));
                reader.readAsArrayBuffer(this);
            });
        };
        Object.assign(URL, {createObjectURL: () => "blob:test", revokeObjectURL: () => {}});
        vi.stubGlobal("Image", FakeImage);
        vi.stubGlobal("OffscreenCanvas", FakeOffscreenCanvas);
        vi.stubGlobal("ImageDecoder", FakeImageDecoder);
        vi.stubGlobal("createImageBitmap", async () => drawable("left"));
    });

    it("움직이는 gif는 정해 둔 시각마다 그 시각을 덮는 프레임을 읽고, 고른 장면은 뺀다", async () => {
        // 0초, 0.505초, 1.505초, 3.005초를 덮는 프레임: right, flat(뺌), left, right. 마지막 프레임은 시각을 지나 읽지 않는다.
        frames = [[0.5, "right"], [0.5, "flat"], [1, "left"], [2, "right"], [1, "left"]];
        expect(dHashes(await imageFingerprints(file("GIF89a")))).toEqual(["f".repeat(16), "0".repeat(16), "f".repeat(16)]);
        expect(decodedType).toBe("image/gif");
    });

    it("한 프레임이 여러 시각을 덮으면 그 장면을 시각마다 넣는다", async () => {
        frames = [[1, "right"], [5, "left"]];
        expect(dHashes(await imageFingerprints(file("RIFF\0\0\0\0WEBP")))).toEqual(["f".repeat(16), "f".repeat(16), "0".repeat(16), "0".repeat(16)]);
        expect(decodedType).toBe("image/webp");
    });

    it("모든 장면이 고르면 지문을 구하지 못한 것으로 본다", async () => {
        frames = [[1, "flat"], [5, "flat"]];
        expect(await imageFingerprints(file("GIF89a"))).toBeUndefined();
    });

    it("프레임이 하나뿐인 gif와 다른 이미지는 정지 이미지로 본다", async () => {
        frames = [[1, "right"]];
        expect(dHashes(await imageFingerprints(file("GIF89a")))).toEqual(["0".repeat(16)]);
        expect(dHashes(await imageFingerprints(file("PNG")))).toEqual(["0".repeat(16)]);
    });

    it("정지 이미지는 캔버스를 읽기 전에 비트맵을 닫는다", async () => {
        events = [];
        vi.stubGlobal("createImageBitmap", async () => ({...drawable("left"), close: () => events.push("close")}));
        await imageFingerprints(file("PNG"));
        expect(events.slice(0, 2)).toEqual(["close", "read"]);
    });
});
