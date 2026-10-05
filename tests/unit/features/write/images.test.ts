import {afterEach, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";

import {hookUploads, type ImageOptions, UPLOAD_OPTIONS_KEY} from "@/features/write/images";

import {tick} from "../../../helpers";

// jsdom에 없는 것들. 이미지 디코딩·인코딩은 결과 크기만 정하는 가짜로 둔다.
class FakeDataTransfer {
    readonly files: File[] = [];
    readonly items = {add: (file: File): void => void this.files.push(file)};
}

class FakeDragEvent extends Event {
    readonly dataTransfer: FakeDataTransfer | null;

    constructor(type: string, init: EventInit & { dataTransfer?: FakeDataTransfer | null }) {
        super(type, init);
        this.dataTransfer = init.dataTransfer ?? null;
    }
}

/** 캔버스가 만들 WebP 크기 (바이트). */
let webpSize = 1;
const createImageBitmap = vi.fn(async () => ({width: 1, height: 1, close: () => {}}));

class FakeOffscreenCanvas {
    getContext = () => ({drawImage: () => {}});
    convertToBlob = async () => new Blob([new Uint8Array(webpSize)], {type: "image/webp"});
}

beforeAll(() => {
    // jsdom의 Blob에는 arrayBuffer가 없다.
    Blob.prototype.arrayBuffer ??= function (this: Blob) {
        return new Promise<ArrayBuffer>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => (reader.result !== null && typeof reader.result !== "string" ? resolve(reader.result) : reject(new Error("읽기 실패")));
            reader.readAsArrayBuffer(this);
        });
    };
    vi.stubGlobal("DataTransfer", FakeDataTransfer);
    vi.stubGlobal("DragEvent", FakeDragEvent);
    vi.stubGlobal("OffscreenCanvas", FakeOffscreenCanvas);
    vi.stubGlobal("createImageBitmap", createImageBitmap);
    hookUploads(UPLOAD_OPTIONS_KEY);
    // 두 번 걸어도 한 번만 바꾼다.
    hookUploads(UPLOAD_OPTIONS_KEY);
});

const setOptions = (options: ImageOptions | null): void => {
    if (options) document.documentElement.dataset[UPLOAD_OPTIONS_KEY] = JSON.stringify(options);
    else delete document.documentElement.dataset[UPLOAD_OPTIONS_KEY];
};

/** PNG 청크 하나 (길이 4 + 이름 4 + 데이터 + CRC 4). */
const chunk = (type: string, length: number): number[] => [0, 0, 0, length, ...Array.from(type, (char) => char.charCodeAt(0)), ...new Array<number>(length + 4).fill(0)];
const png = (name: string, chunks: string[], padding = 100): File => {
    const sizes: Record<string, number> = {IHDR: 13, acTL: 8, IDAT: padding, IEND: 0};
    const bytes = [137, 80, 78, 71, 13, 10, 26, 10, ...chunks.flatMap((type) => chunk(type, sizes[type] ?? 0))];
    return new File([new Uint8Array(bytes)], name, {type: "image/png"});
};

let input: HTMLInputElement;
/** 페이지 스크립트(디시)가 받은 파일 목록. */
let received: File[][];

/** 파일 선택칸에서 files를 고른 것처럼 change를 보낸다. jsdom은 files에 FileList만 받아 속성으로 바꿔 둔다. */
const choose = (files: File[]): void => {
    Object.defineProperty(input, "files", {value: files, writable: true, configurable: true});
    input.dispatchEvent(new Event("change", {bubbles: true}));
};

beforeEach(() => {
    webpSize = 1;
    received = [];
    input = document.body.appendChild(Object.assign(document.createElement("input"), {type: "file"}));
    input.addEventListener("change", () => received.push([...(input.files ?? [])]));
});

afterEach(() => {
    setOptions(null);
    document.body.innerHTML = "";
});

describe("파일 선택칸", () => {
    it("설정이 없으면 건드리지 않는다", async () => {
        const file = png("a.png", ["IHDR", "IDAT"]);
        choose([file]);
        expect(received).toEqual([[file]]);
    });

    it("이름 숨기기는 확장자를 남기고 무작위 이름으로 바꾼다", async () => {
        setOptions({webp: false, quality: 0.8, rename: true});
        const text = new File(["글"], "메모.txt", {type: "text/plain"});
        choose([png("내 사진.PNG", ["IHDR", "IDAT"]), text]);
        expect(received).toEqual([]);
        await vi.waitFor(() => expect(received).toHaveLength(1));
        const [renamed, kept] = received[0]!;
        expect(renamed?.name).toMatch(/^[0-9a-f-]{36}\.png$/);
        expect(renamed?.type).toBe("image/png");
        expect(kept).toBe(text);
    });

    it("WebP가 더 작으면 바꾸고 이름은 그대로 둔다", async () => {
        setOptions({webp: true, quality: 0.5, rename: false});
        choose([png("사진.png", ["IHDR", "IDAT"])]);
        await vi.waitFor(() => expect(received).toHaveLength(1));
        expect(received[0]?.[0]?.name).toBe("사진.webp");
        expect(received[0]?.[0]?.type).toBe("image/webp");
    });

    it("WebP가 더 크면 원본을 올린다", async () => {
        webpSize = 10_000;
        setOptions({webp: true, quality: 0.5, rename: false});
        const file = png("사진.png", ["IHDR", "IDAT"]);
        choose([file]);
        await vi.waitFor(() => expect(received).toHaveLength(1));
        expect(received[0]?.[0]).toBe(file);
    });

    it("움직이는 PNG는 WebP로 바꾸지 않는다", async () => {
        setOptions({webp: true, quality: 0.5, rename: false});
        const file = png("움짤.png", ["IHDR", "acTL", "IDAT"]);
        choose([file]);
        await vi.waitFor(() => expect(received).toHaveLength(1));
        expect(received[0]?.[0]).toBe(file);
        expect(createImageBitmap).not.toHaveBeenCalled();
    });

    it("디코딩하지 못한 이미지는 원본을 올린다", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        createImageBitmap.mockRejectedValueOnce(new Error("깨진 이미지"));
        setOptions({webp: true, quality: 0.5, rename: false});
        const file = png("깨짐.png", ["IHDR", "IDAT"]);
        choose([file]);
        await vi.waitFor(() => expect(received).toHaveLength(1));
        expect(received[0]?.[0]).toBe(file);
    });

    it("GIF·WebP는 WebP 변환 대상이 아니다", async () => {
        setOptions({webp: true, quality: 0.5, rename: false});
        const gif = new File(["GIF89a"], "a.gif", {type: "image/gif"});
        choose([gif]);
        expect(received).toEqual([[gif]]);
    });
});

describe("붙여넣기·끌어 놓기", () => {
    const EDITOR = "<div class=\"note-editor\"><div class=\"note-dropzone\"></div><div class=\"note-editable\"><p id=\"caret\"></p></div></div>";

    /** files를 실은 이벤트. jsdom에는 clipboardData·dataTransfer가 없어 속성으로 붙인다. */
    const transferEvent = (type: "paste" | "drop", files: File[]): Event => {
        const ev = new Event(type, {bubbles: true, cancelable: true});
        const transfer = new FakeDataTransfer();
        for (const file of files) transfer.items.add(file);
        Object.defineProperty(ev, type === "paste" ? "clipboardData" : "dataTransfer", {value: transfer});
        return ev;
    };

    it("에디터 안에 붙여 넣은 이미지는 바꿔 끌어 놓기 칸에 넘긴다", async () => {
        document.body.innerHTML = EDITOR;
        setOptions({webp: false, quality: 0.8, rename: true});
        const dropped: File[][] = [];
        document.querySelector(".note-dropzone")!.addEventListener("drop", (ev) => {
            if (ev instanceof FakeDragEvent) dropped.push([...ev.dataTransfer?.files ?? []]);
        });

        const ev = transferEvent("paste", [png("a.png", ["IHDR", "IDAT"])]);
        document.getElementById("caret")!.dispatchEvent(ev);
        expect(ev.defaultPrevented).toBe(true);
        await vi.waitFor(() => expect(dropped).toHaveLength(1));
        expect(dropped[0]?.[0]?.name).toMatch(/^[0-9a-f-]{36}\.png$/);
    });

    it("에디터 밖은 건드리지 않는다", async () => {
        setOptions({webp: false, quality: 0.8, rename: true});
        const ev = transferEvent("drop", [png("a.png", ["IHDR", "IDAT"])]);
        document.body.dispatchEvent(ev);
        await tick();
        expect(ev.defaultPrevented).toBe(false);
    });
});
