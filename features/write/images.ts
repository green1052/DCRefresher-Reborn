import pLimit from "p-limit";

import {isRecord} from "@/utils/record";

/** 올리는 이미지를 바꾸는 방법. 모듈이 <html>의 data 속성에 JSON으로 두고, 페이지에 넣은 hookUploads가 이벤트마다 읽는다. */
export interface ImageOptions {
    webp: boolean;
    /** WebP 품질 (0~1). */
    quality: number;
    rename: boolean;
    /** 한꺼번에 바꾸는 이미지 수. 원본 크기 캔버스가 이만큼 함께 살아 있다. */
    concurrency: number;
}

/** ImageOptions를 두는 <html> dataset 키. 없으면(모듈이 꺼졌거나 두 설정이 다 꺼짐) 파일을 그대로 둔다. */
export const UPLOAD_OPTIONS_KEY = "refresherUpload";

/**
 * 탭의 페이지 컨텍스트(MAIN world)에서 실행된다. entrypoints/upload-hook.ts가 따로 번들하고, 배경이 페이지마다 한 번 그 파일을 넣는다.
 * 글쓰기 에디터에 붙여 넣거나 끌어 놓은 이미지, 파일 선택칸(이미지 올리기 팝업·에디터 이미지 창·자동 짤방)에서 고른 이미지를 바꾼다.
 * 디시 스크립트보다 먼저(window 캡처 단계에서) 이벤트를 막고, 바꾼 파일로 이벤트를 다시 보낸다.
 * 페이지에서 하는 까닭: 파이어폭스는 콘텐츠 스크립트가 DataTransfer에 넣은 파일을 페이지 스크립트에 보여 주지 않는다.
 */
export const hookUploads = (): void => {
    const hooked = Symbol.for("refresher.uploads");
    const scope = window as Window & { [hooked]?: true };
    if (scope[hooked]) return;
    scope[hooked] = true;

    // 페이지 스크립트도 바꿀 수 있는 속성이라 모양을 확인한다. 동시 변환 수가 1 이상의 정수가 아니면 pLimit이 던져, 이미 막은 업로드가 사라진다.
    const readOptions = (): ImageOptions | null => {
        try {
            const raw = document.documentElement.dataset[UPLOAD_OPTIONS_KEY];
            const parsed: unknown = raw ? JSON.parse(raw) : null;
            if (!isRecord(parsed)) return null;
            const {webp, quality, rename, concurrency} = parsed;
            return typeof webp === "boolean" && typeof rename === "boolean" && typeof quality === "number" && Number.isFinite(quality)
                && typeof concurrency === "number" && Number.isInteger(concurrency) && concurrency >= 1
                ? {webp, quality, rename, concurrency} : null;
        } catch {
            return null;
        }
    };

    // 움짤은 캔버스가 첫 장면만 그리므로 WebP로 바꾸지 않고 이름만 바꾼다. AVIF는 WebP보다 작고 움직일 수도 있어 그대로 둔다.
    // .apng는 크로미움이 image/apng로 준다 (image/png인 APNG는 아래 isApng가 찾는다).
    const keepFormat = (file: File): boolean => ["image/gif", "image/webp", "image/avif", "image/apng"].includes(file.type);
    // 움직이는 PNG(APNG)는 acTL 청크가 첫 IDAT보다 앞에 있다. 서명(8바이트) 뒤 청크 머리(길이 4 + 이름 4)만 따라가며 읽는다.
    // 앞쪽 메타데이터 청크(EXIF·ICC 등)가 커도 놓치지 않고, 이미지 데이터는 읽지 않는다.
    const isApng = async (file: File): Promise<boolean> => {
        if (file.type !== "image/png") return false;
        for (let offset = 8; offset + 8 <= file.size;) {
            const head = new DataView(await file.slice(offset, offset + 8).arrayBuffer());
            const type = String.fromCharCode(head.getUint8(4), head.getUint8(5), head.getUint8(6), head.getUint8(7));
            if (type === "acTL") return true;
            if (type === "IDAT" || type === "IEND") return false;
            // 머리 8바이트 + 데이터 + CRC 4바이트.
            offset += 12 + head.getUint32(0);
        }
        return false;
    };
    // 이미 바꾼(또는 바꿀 것 없는) 파일. 바꾼 뒤 다시 보낸 이벤트를 또 가로채지 않게 한다.
    const done = new WeakSet<File>();
    const needsWork = (file: File, options: ImageOptions): boolean =>
        !done.has(file) && file.type.startsWith("image/") && (options.rename || (options.webp && !keepFormat(file)));

    const named = (blob: Blob, original: File, ext: string, rename: boolean): File =>
        new File([blob], `${rename ? crypto.randomUUID() : original.name.replace(/\.[^.]*$/, "")}.${ext}`, {type: blob.type});

    const toWebp = async (file: File, quality: number): Promise<Blob | null> => {
        // createImageBitmap이 EXIF 회전을 적용하고, 캔버스로 다시 그려 위치 정보 같은 메타데이터도 빠진다.
        const bitmap = await createImageBitmap(file);
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
        bitmap.close();
        const webp = await canvas.convertToBlob({type: "image/webp", quality});
        // WebP를 만들 수 없는 브라우저는 PNG를 준다.
        return webp.type === "image/webp" ? webp : null;
    };

    const convert = async (file: File, options: ImageOptions): Promise<File> => {
        if (!needsWork(file, options)) return file;

        if (options.webp && !keepFormat(file)) {
            // 파일 읽기(isApng)도 안에 둔다. 여기서 던지면 막아 둔 업로드 이벤트를 다시 보내지 못해 이미지가 올라가지 않는다.
            try {
                const webp = (await isApng(file)) ? null : await toWebp(file, options.quality);
                // 이미 잘 압축된 JPEG는 WebP가 더 클 수 있다. 그때는 원본을 올린다.
                if (webp && webp.size < file.size) return named(webp, file, "webp", options.rename);
            } catch (e) {
                // 읽거나 디코딩하지 못한 이미지는 원본 그대로 올려 디시가 판단하게 한다.
                console.error(e);
            }
        }

        const ext = /\.([^.]+)$/.exec(file.name)?.[1] ?? file.type.slice("image/".length);
        return options.rename ? named(file, file, ext.toLowerCase(), true) : file;
    };

    // 파이어폭스 resistFingerprinting(LibreWolf·토르 등)은 캔버스를 읽을 때마다 무작위 잡음을 준다. 잡음 WebP는 작아서 원본 대신 올라간다.
    // 같은 그림을 두 번 인코딩해 바이트가 같은지 본다. 업로드마다 보므로 사이트에 캔버스 읽기를 허락하면 다음부터 바뀐다.
    const canvasReliable = async (): Promise<boolean> => {
        const encode = async (): Promise<string> => {
            const canvas = new OffscreenCanvas(1, 1);
            const context = canvas.getContext("2d");
            if (context) {
                context.fillStyle = "#f00";
                context.fillRect(0, 0, 1, 1);
            }
            return new Uint8Array(await (await canvas.convertToBlob({type: "image/webp"})).arrayBuffer()).join();
        };
        try {
            return await encode() === await encode();
        } catch (e) {
            console.error(e);
            return false;
        }
    };

    const convertAll = async (files: File[], options: ImageOptions): Promise<DataTransfer> => {
        const transfer = new DataTransfer();
        // 캔버스를 믿을 수 없으면 WebP 변환만 끄고 이름 숨기기는 그대로 한다.
        const settings = options.webp && !(await canvasReliable()) ? {...options, webp: false} : options;
        // 큰 사진 여러 장을 한꺼번에 바꾸면 원본 크기 캔버스가 장수만큼 메모리에 쌓인다. 결과는 고른 순서대로 온다.
        for (const file of await pLimit(settings.concurrency).map(files, (file) => convert(file, settings))) {
            done.add(file);
            transfer.items.add(file);
        }
        return transfer;
    };

    /** 바꿀 파일이 있으면 파일 목록과 그때의 설정을 돌려준다. */
    const pending = (files: FileList | null | undefined): [File[], ImageOptions] | null => {
        const options = readOptions();
        const list = Array.from(files ?? []);
        return options && list.some((file) => needsWork(file, options)) ? [list, options] : null;
    };

    window.addEventListener("change", (ev) => {
        const input = ev.target;
        if (!(input instanceof HTMLInputElement) || input.type !== "file") return;
        const found = pending(input.files);
        if (!found) return;

        ev.stopImmediatePropagation();
        void convertAll(...found).then((transfer) => {
            input.files = transfer.files;
            input.dispatchEvent(new Event("change", {bubbles: true}));
        });
    }, true);

    // 붙여넣기·끌어 놓기는 에디터(summernote) 안과 이미지 올리기 팝업에서 바꾼다. 이벤트가 끝나면 clipboardData·dataTransfer를 읽을 수 없어 파일을 먼저 꺼낸다.
    // 에디터에서는 바꾼 파일을 둘 다 끌어 놓기 칸에 drop으로 넘긴다. 파이어폭스는 만든 paste 이벤트에 파일을 실을 수 없다(clipboardData를 무시한다).
    // 팝업은 jQuery File Upload가 문서 어디에 놓거나 붙여 넣어도 받는다. 만든 drop은 webkitGetAsEntry가 null이라 못 읽으므로 파일 선택칸의 change로 넘긴다.
    const intercept = (ev: Event, transfer: DataTransfer | null): void => {
        const dropzone = ev.target instanceof Element ? ev.target.closest(".note-editor")?.querySelector(".note-dropzone") : null;
        const input = dropzone ? null : document.querySelector<HTMLInputElement>("#fileupload input[type=file]");
        const found = (dropzone || input) && pending(transfer?.files);
        if (!found) return;

        ev.preventDefault();
        ev.stopImmediatePropagation();
        void convertAll(...found).then((dataTransfer) => {
            if (dropzone) dropzone.dispatchEvent(new DragEvent("drop", {dataTransfer, bubbles: true, cancelable: true}));
            else if (input) {
                input.files = dataTransfer.files;
                input.dispatchEvent(new Event("change", {bubbles: true}));
            }
        });
    };

    window.addEventListener("paste", (ev) => intercept(ev, ev.clipboardData), true);
    window.addEventListener("drop", (ev) => intercept(ev, ev.dataTransfer), true);
};
