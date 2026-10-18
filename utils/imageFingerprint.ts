/**
 * 비슷한 이미지 지문: 밝기의 dHash(64비트)와 pHash(64비트)를 이은 32자 16진수. 이미지 차단 항목의 similar다.
 * 두 해시가 모두 기준 안이어야 비슷하다고 본다 (isSimilar). 하나만 보면 서로 다른 이미지가 가깝게 나오는 일이 잦다.
 * 브라우저가 줄이면 크롬과 파이어폭스의 화소가 달라지므로 원본 크기로 디코딩해 직접 면적 평균으로 줄인다. 그러면 두 브라우저의 지문이 같다.
 * 움짤(mp4, 움직이는 gif·webp)은 정해 둔 시각의 장면 몇 개를 표본으로 지문을 구한다 (항목의 similar와 frames).
 */
import pLimit from "p-limit";

/** 이보다 큰 이미지는 보지 않는다. 화소를 한 번에 읽어(화소당 4바이트) 메모리가 크게 든다. */
export const MAX_PIXELS = 25_000_000;

/** 1차원 면적 평균의 가중치: 출력 칸마다 첫 입력 위치와, 거기서부터 이어진 입력의 비율. */
const boxWeights = (size: number, cells: number): { first: number; weights: Float64Array }[] => {
    const step = size / cells;
    return Array.from({length: cells}, (_, cell) => {
        const start = cell * step;
        const end = start + step;
        const first = Math.floor(start);
        const weights = Float64Array.from({length: Math.min(size, Math.ceil(end)) - first}, (_, k) => (Math.min(end, first + k + 1) - Math.max(start, first + k)) / step);
        return {first, weights};
    });
};

/** y번째 행의 밝기를 luma에 채운다. */
type RowLuma = (y: number, luma: Float64Array) => void;

/** RGBA 화소의 밝기 (0.299R + 0.587G + 0.114B). */
const rgbaRows = (rgba: Uint8ClampedArray, width: number): RowLuma => (y, luma) => {
    for (let x = 0, p = y * width * 4; x < width; x++, p += 4) luma[x] = 0.299 * rgba[p]! + 0.587 * rgba[p + 1]! + 0.114 * rgba[p + 2]!;
};

/** 동영상 프레임의 밝기 평면(Y). 색 변환을 거치지 않아 두 브라우저가 같은 값을 준다. */
const planeRows = (plane: Uint8Array, offset: number, stride: number): RowLuma => (y, luma) => {
    luma.set(plane.subarray(offset + y * stride, offset + y * stride + luma.length));
};

/** dHash의 9×8 칸과 pHash의 32×32 칸. */
type Grids = [small: Float64Array, large: Float64Array];

/**
 * 밝기를 dHash의 9×8 칸과 pHash의 32×32 칸으로 면적 평균해 줄인다. 행 우선이다.
 * 화소는 한 번만 읽는다. 큰 이미지에서는 이 반복이 거의 모든 시간이다.
 */
const lumaGrids = (width: number, height: number, rowLuma: RowLuma): Grids => {
    const plan = (columns: number, rows: number) => ({columns, rows, byColumn: boxWeights(width, columns), narrowed: new Float64Array(height * columns)});
    const plans = [plan(9, 8), plan(32, 32)] as const;
    const luma = new Float64Array(width);
    for (let y = 0; y < height; y++) {
        rowLuma(y, luma);
        for (const {columns, byColumn, narrowed} of plans) {
            for (let column = 0; column < columns; column++) {
                const {first, weights} = byColumn[column]!;
                let sum = 0;
                for (let k = 0; k < weights.length; k++) sum += luma[first + k]! * weights[k]!;
                narrowed[y * columns + column] = sum;
            }
        }
    }

    const reduce = ({columns, rows, narrowed}: (typeof plans)[number]): Float64Array => {
        const byRow = boxWeights(height, rows);
        const grid = new Float64Array(rows * columns);
        for (let row = 0; row < rows; row++) {
            const {first, weights} = byRow[row]!;
            for (let column = 0; column < columns; column++) {
                let sum = 0;
                for (let k = 0; k < weights.length; k++) sum += narrowed[(first + k) * columns + column]! * weights[k]!;
                grid[row * columns + column] = sum;
            }
        }
        return grid;
    };
    return [reduce(plans[0]), reduce(plans[1])];
};

/** 좌우 반전. 면적 평균은 반전과 순서를 바꿔도 같아서 줄인 칸만 뒤집으면 된다. */
const mirror = (grid: Float64Array, columns: number): Float64Array =>
    grid.map((_, i) => grid[i - (i % columns) + columns - 1 - (i % columns)]!);

const toHex = (bits: boolean[]): string => {
    let hex = "";
    for (let i = 0; i < bits.length; i += 4) hex += (Number(bits[i]) * 8 + Number(bits[i + 1]) * 4 + Number(bits[i + 2]) * 2 + Number(bits[i + 3])).toString(16);
    return hex;
};

/** dHash: 9×8 칸에서 왼쪽이 오른쪽보다 어두우면 1. */
const dHash = (grid: Float64Array): string =>
    toHex(Array.from({length: 64}, (_, i) => grid[i + Math.floor(i / 8)]! < grid[i + Math.floor(i / 8) + 1]!));

// cos((2x + 1)uπ / 64), u = 0..7, x = 0..31.
const COS = Float64Array.from({length: 8 * 32}, (_, i) => Math.cos(((2 * (i % 32) + 1) * Math.floor(i / 32) * Math.PI) / 64));

/** pHash: 32×32 칸의 2차원 DCT-II에서 왼쪽 위 8×8 계수가 DC를 뺀 63개의 중앙값보다 크면 1. */
const pHash = (grid: Float64Array): string => {
    // 가로 방향 먼저: rowsByFrequency[v * 32 + y] = Σx cos(v, x)·grid[y][x]
    const rowsByFrequency = new Float64Array(8 * 32);
    for (let v = 0; v < 8; v++) {
        for (let y = 0; y < 32; y++) {
            let sum = 0;
            for (let x = 0; x < 32; x++) sum += COS[v * 32 + x]! * grid[y * 32 + x]!;
            rowsByFrequency[v * 32 + y] = sum;
        }
    }
    const coefficients = new Float64Array(64);
    for (let u = 0; u < 8; u++) {
        for (let v = 0; v < 8; v++) {
            let sum = 0;
            for (let y = 0; y < 32; y++) sum += COS[u * 32 + y]! * rowsByFrequency[v * 32 + y]!;
            coefficients[u * 8 + v] = sum;
        }
    }
    const median = coefficients.slice(1).sort()[31]!;
    return toHex(Array.from(coefficients, (coefficient) => coefficient > median));
};

/** 장면 하나의 표본: 지문과 좌우 반전본의 지문. */
export type Sample = [fingerprint: string, mirrored: string];

const sampleOf = ([small, large]: Grids): Sample => [dHash(small) + pHash(large), dHash(mirror(small, 9)) + pHash(mirror(large, 32))];

export const fingerprintsOf = (rgba: Uint8ClampedArray, width: number, height: number): Sample => sampleOf(lumaGrids(width, height, rgbaRows(rgba, width)));

/**
 * 움짤에서 표본을 뜨는 시각(초). 앞부분만 보므로 gif와 그걸 바꾼 mp4처럼 길이가 조금 다른 것도 같은 장면을 본다.
 * 0 말고는 GIF 시간 단위(10ms)의 절반을 더한다. 프레임 경계에 딱 맞는 시각은 브라우저마다 앞뒤 프레임으로 갈린다.
 */
const SAMPLE_TIMES = [0, 0.505, 1.505, 3.005];

/** 밝기가 거의 고른 장면(검은 화면·흰 화면). 어느 움짤의 앞뒤에나 있어 표본으로 쓰지 않는다. */
const isFlat = ([small]: Grids): boolean => Math.max(...small) - Math.min(...small) < 8;

/** 흰 바탕에 그려 RGBA로 읽은 그리드. 바탕이 없으면 반투명한 곳의 값이 브라우저마다 다르다. 그리기 전에 돌아오면 source를 닫지 않으니 부른 쪽도 닫는다. */
const drawnGrids = (source: ImageBitmap | VideoFrame, width: number, height: number): Grids | undefined => {
    const context = width * height <= MAX_PIXELS ? new OffscreenCanvas(width, height).getContext("2d", {willReadFrequently: true}) : null;
    if (!context) return undefined;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, width, height);
    context.drawImage(source, 0, 0);
    // 캔버스에 옮기면 바로 놓는다. 큰 이미지에서 화소가 세 벌 남지 않게 한다 (크롬. 파이어폭스는 닫아도 나중에 놓는다).
    source.close();
    return lumaGrids(width, height, rgbaRows(context.getImageData(0, 0, width, height).data, width));
};

/** 동영상 프레임의 그리드. Y 평면이 있는 형식(크롬 NV12, 파이어폭스 배경 I420)은 그것을 쓰고, 아니면 그려서 읽는다. */
const frameGrids = async (frame: VideoFrame): Promise<Grids | undefined> => {
    const {format, visibleRect} = frame;
    if ((format !== "I420" && format !== "I420A" && format !== "NV12") || !visibleRect) return drawnGrids(frame, frame.displayWidth, frame.displayHeight);
    // copyTo는 visibleRect만 옮기고 그 배치(offset·stride)를 돌려준다.
    const buffer = new Uint8Array(frame.allocationSize());
    const [plane] = await frame.copyTo(buffer);
    return plane && lumaGrids(visibleRect.width, visibleRect.height, planeRows(buffer, plane.offset, plane.stride));
};

/**
 * 동영상 하나의 지문을 이 시간(ms) 안에 못 구하면 실패로 본다. 지문은 한 번에 하나씩 구하므로 멈춘 동영상 하나가 뒤의 모든 이미지를 막지 않게 한다.
 * AbortSignal.timeout은 파이어폭스 콘텐츠 스크립트에서 던져 타이머로 끊는다 (docs/firefox.md).
 */
const VIDEO_TIMEOUT = 15_000;

/** 다음 type 이벤트. 오류가 나거나 deadline이 끝나면 실패한다. */
const nextEvent = (media: HTMLMediaElement, type: string, deadline: AbortSignal): Promise<void> => new Promise((resolve, reject) => {
    const listeners = new AbortController();
    const finish = (error?: Error): void => {
        listeners.abort();
        if (error) reject(error);
        else resolve();
    };
    if (deadline.aborted) return finish(new Error(`${type} timed out`));
    deadline.addEventListener("abort", () => finish(new Error(`${type} timed out`)), {signal: listeners.signal});
    media.addEventListener(type, () => finish(), {signal: listeners.signal});
    media.addEventListener("error", () => finish(new Error("media error")), {signal: listeners.signal});
});

/** mp4의 그리드들. 문서에 붙이지 않은 <video>로 열어 시각마다 멈춘 장면을 읽는다. 재생하지 않아 자동 재생 규칙에 걸리지 않는다. */
const videoGrids = async (file: Blob): Promise<Grids[]> => {
    const video = document.createElement("video");
    const src = URL.createObjectURL(file);
    const deadline = new AbortController();
    const timer = setTimeout(() => deadline.abort(), VIDEO_TIMEOUT);
    video.muted = true;
    video.preload = "auto";
    try {
        video.src = src;
        await nextEvent(video, "loadeddata", deadline.signal);
        if (video.videoWidth * video.videoHeight > MAX_PIXELS) return [];
        const grids: Grids[] = [];
        for (const time of SAMPLE_TIMES.filter((time) => time < video.duration)) {
            if (time > 0) {
                video.currentTime = time;
                await nextEvent(video, "seeked", deadline.signal);
            }
            const frame = new VideoFrame(video);
            try {
                const frameGrid = await frameGrids(frame);
                if (frameGrid) grids.push(frameGrid);
            } finally {
                frame.close();
            }
        }
        return grids;
    } finally {
        clearTimeout(timer);
        // 떼어 내기만 하면 계속 붙잡고 있다. 소스를 비우고 load()로 놓는다.
        video.removeAttribute("src");
        video.load();
        URL.revokeObjectURL(src);
    }
};

/**
 * 움직이는 gif·webp의 그리드들. 프레임을 앞에서부터 풀며 각 시각을 덮는 프레임을 읽고, 마지막 시각을 지나면 멈춘다.
 * 프레임이 하나뿐이거나 ImageDecoder가 없으면 undefined라 정지 이미지로 본다 (첫 프레임).
 */
const animationGrids = async (file: Blob, type: string): Promise<Grids[] | undefined> => {
    if (typeof ImageDecoder === "undefined") return undefined;
    const decoder = new ImageDecoder({data: await file.arrayBuffer(), type});
    try {
        // completed 뒤에도 트랙은 tracks.ready까지 비어 있다 (크롬).
        await decoder.completed;
        await decoder.tracks.ready;
        const frameCount = decoder.tracks.selectedTrack?.frameCount ?? 0;
        if (frameCount <= 1) return undefined;
        const grids: Grids[] = [];
        const times = [...SAMPLE_TIMES];
        for (let index = 0; index < frameCount && times.length > 0; index++) {
            const {image} = await decoder.decode({frameIndex: index});
            try {
                // 시각은 마이크로초다.
                const end = (image.timestamp + (image.duration ?? 0)) / 1e6;
                if (times[0]! >= end) continue;
                const frameGrid = drawnGrids(image, image.displayWidth, image.displayHeight);
                for (; times.length > 0 && times[0]! < end; times.shift()) {
                    if (frameGrid) grids.push(frameGrid);
                }
            } finally {
                image.close();
            }
        }
        return grids;
    } finally {
        decoder.close();
    }
};

/** 파일 앞머리로 본 종류. 디시는 모든 파일을 application/octet-stream으로 준다. */
const kindOf = async (file: Blob): Promise<"video" | "image/gif" | "image/webp" | "image"> => {
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const text = (from: number, to: number): string => String.fromCharCode(...head.subarray(from, to));
    if (text(4, 8) === "ftyp") return "video";
    if (text(0, 4) === "GIF8") return "image/gif";
    return text(0, 4) === "RIFF" && text(8, 12) === "WEBP" ? "image/webp" : "image";
};

/**
 * 디코딩하지 않고 화소 수만 읽는다. 문서에 붙이지 않은 <img>는 그리지 않아 디코딩하지 않는다.
 * 파이어폭스 콘텐츠 스크립트가 만든 blob 주소는 페이지 문서가 읽지 못해 실패한다. 그때는 0을 줘 디코딩 뒤의 검사에 맡긴다.
 */
const pixelsOf = (file: Blob): Promise<number> => {
    const image = new Image();
    const src = URL.createObjectURL(file);
    return new Promise<number>((resolve) => {
        image.onload = () => resolve(image.naturalWidth * image.naturalHeight);
        image.onerror = () => resolve(0);
        image.src = src;
    }).finally(() => URL.revokeObjectURL(src));
};

/** 움짤의 표본. 장면이 여럿이라 고른 장면은 뺀다. 남는 것이 없으면 구하지 못한 것으로 본다. */
const animatedSamples = (grids: Grids[]): Sample[] | undefined => {
    const samples = grids.filter((grid) => !isFlat(grid)).map(sampleOf);
    return samples.length > 0 ? samples : undefined;
};

const fingerprint = async (file: Blob): Promise<Sample[] | undefined> => {
    try {
        const kind = await kindOf(file);
        // ftyp로 시작하는 정지 이미지(AVIF·HEIC)도 있어, 동영상으로 열지 못하면 정지 이미지로 본다.
        const video = kind === "video" ? animatedSamples(await videoGrids(file).catch(() => [])) : undefined;
        if (video) return video;

        // 원본 크기로 디코딩하기만 해도 메모리를 크게 쓴다. 파일은 작아도 화소가 아주 많은 이미지가 있어 디코딩 전에 본다.
        if ((await pixelsOf(file)) > MAX_PIXELS) return undefined;
        const animation = kind === "image/gif" || kind === "image/webp" ? await animationGrids(file, kind) : undefined;
        if (animation) return animatedSamples(animation);

        const bitmap = await createImageBitmap(file, {colorSpaceConversion: "none", premultiplyAlpha: "none", imageOrientation: "from-image"});
        const grids = drawnGrids(bitmap, bitmap.width, bitmap.height);
        bitmap.close();
        return grids && [sampleOf(grids)];
    } catch {
        return undefined;
    }
};

// 한 번에 하나씩 구한다. 그림이 많은 글에서 모든 이미지를 한꺼번에 디코딩하면 메모리가 이미지 수만큼 든다.
const serial = pLimit(1);

/**
 * 이미지 파일의 표본들. 정지 이미지는 하나, 움짤은 정해 둔 시각마다 하나다 (고른 장면은 뺀다).
 * 판정은 표본의 지문과 좌우 반전본 지문을 둘 다 보고, 차단 항목에는 지문만 넣는다. 디코딩하지 못하거나 너무 크면 undefined다.
 */
export const imageFingerprints = (file: Blob): Promise<Sample[] | undefined> => serial(() => fingerprint(file));

const popcount = (value: number): number => {
    let n = value >>> 0;
    n -= (n >>> 1) & 0x55555555;
    n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
    return (((n + (n >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
};

/** 16진수 지문의 [from, from + 16) 구간(64비트)에서 다른 비트 수. */
const distance = (a: string, b: string, from: number): number =>
    popcount(parseInt(a.slice(from, from + 8), 16) ^ parseInt(b.slice(from, from + 8), 16)) +
    popcount(parseInt(a.slice(from + 8, from + 16), 16) ^ parseInt(b.slice(from + 8, from + 16), 16));

/** 두 지문이 비슷한지: dHash와 pHash가 모두 threshold비트 이하로 다르다. */
export const isSimilar = (a: string, b: string, threshold: number): boolean =>
    distance(a, b, 0) <= threshold && distance(a, b, 16) <= threshold;

/**
 * 표본들이 차단 항목의 지문들(prints)과 비슷한지. 표본의 원본이나 좌우 반전본이 어느 지문과 비슷하면 그 표본은 맞은 것이다.
 * 한쪽이 장면 하나(정지 이미지)면 하나만 맞아도 되고, 둘 다 움짤이면 하나 빼고 다 맞아야 한다. 같은 방송의 다른 움짤처럼
 * 몇 장면만 닮은 것은 막지 않는다. 순서는 보지 않는다 (gif와 그걸 바꾼 mp4는 시간이 조금 어긋난다).
 */
export const isSimilarSet = (samples: Sample[], prints: string[], threshold: number): boolean => {
    const hits = samples.filter((sample) => prints.some((print) => sample.some((fingerprint) => isSimilar(print, fingerprint, threshold)))).length;
    return hits >= (samples.length === 1 || prints.length === 1 ? 1 : samples.length - 1);
};
