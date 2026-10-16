/**
 * 비슷한 이미지 지문: 밝기의 dHash(64비트)와 pHash(64비트)를 이은 32자 16진수. 이미지 차단 항목의 similar다.
 * 두 해시가 모두 기준 안이어야 비슷하다고 본다 (isSimilar). 하나만 보면 서로 다른 이미지가 가깝게 나오는 일이 잦다.
 * 브라우저가 줄이면 크롬과 파이어폭스의 화소가 달라지므로 원본 크기로 디코딩해 직접 면적 평균으로 줄인다. 그러면 두 브라우저의 지문이 같다.
 */

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

/**
 * 밝기(0.299R + 0.587G + 0.114B)를 dHash의 9×8 칸과 pHash의 32×32 칸으로 면적 평균해 줄인다. 행 우선이다.
 * 화소는 한 번만 읽는다. 큰 이미지에서는 이 반복이 거의 모든 시간이다.
 */
const lumaGrids = (rgba: Uint8ClampedArray, width: number, height: number): [small: Float64Array, large: Float64Array] => {
    const plan = (columns: number, rows: number) => ({columns, rows, byColumn: boxWeights(width, columns), narrowed: new Float64Array(height * columns)});
    const plans = [plan(9, 8), plan(32, 32)] as const;
    const luma = new Float64Array(width);
    for (let y = 0; y < height; y++) {
        for (let x = 0, p = y * width * 4; x < width; x++, p += 4) luma[x] = 0.299 * rgba[p]! + 0.587 * rgba[p + 1]! + 0.114 * rgba[p + 2]!;
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

/** RGBA 화소의 지문과 좌우 반전본의 지문. */
export const fingerprintsOf = (rgba: Uint8ClampedArray, width: number, height: number): [string, string] => {
    const [small, large] = lumaGrids(rgba, width, height);
    return [dHash(small) + pHash(large), dHash(mirror(small, 9)) + pHash(mirror(large, 32))];
};

const fingerprint = async (file: Blob): Promise<[string, string] | undefined> => {
    try {
        const bitmap = await createImageBitmap(file, {colorSpaceConversion: "none", premultiplyAlpha: "none", imageOrientation: "from-image"});
        const {width, height} = bitmap;
        // 캔버스에 옮기면 비트맵은 바로 놓는다. 큰 이미지에서 화소가 세 벌 남지 않게 한다.
        const context = width * height <= MAX_PIXELS ? new OffscreenCanvas(width, height).getContext("2d", {willReadFrequently: true}) : null;
        if (context) {
            context.fillStyle = "#fff";
            context.fillRect(0, 0, width, height);
            context.drawImage(bitmap, 0, 0);
        }
        bitmap.close();
        return context ? fingerprintsOf(context.getImageData(0, 0, width, height).data, width, height) : undefined;
    } catch {
        return undefined;
    }
};

// 한 번에 하나씩 구한다. 그림이 많은 글에서 모든 이미지를 한꺼번에 디코딩하면 메모리가 이미지 수만큼 든다.
let queue: Promise<unknown> = Promise.resolve();

/**
 * 이미지 파일의 지문과 좌우 반전본의 지문. 판정은 둘 다 보고, 차단 항목에는 앞의 것을 넣는다.
 * 반투명한 곳은 흰 바탕에 합성한다. 그대로 두면 브라우저마다 값이 다르다. 디코딩하지 못하거나 너무 크면 undefined다.
 */
export const imageFingerprints = (file: Blob): Promise<[string, string] | undefined> => {
    const result = queue.then(() => fingerprint(file));
    queue = result;
    return result;
};

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
