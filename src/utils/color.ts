export type Rgb = [number, number, number];
export type Hsl = [number, number, number];

export const luminance = (...[r, g, b]: Rgb): number => {
    [r, g, b] = [r, g, b]
        .map((v) => v / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return r * 0.2126 + g * 0.7152 + b * 0.0722;
};

export const contrast = (rgb1: Rgb, rgb2: Rgb): number => {
    const lum1 = luminance(...rgb1);
    const lum2 = luminance(...rgb2);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
};

export const parse = (str: string): Rgb => {
    if (str[0] === "#") {
        return (
            (str
                .substring(1)
                .match(/.{1,2}/g)
                ?.map((v) => parseInt(v, 16)) as Rgb) ?? [0, 0, 0]
        );
    } else {
        return str
            .match(/^\w+\((.+)\)$/)![1]
            .split(",")
            .map(Number) as Rgb;
    }
};

// https://gist.github.com/mjackson/5311256
export const rgbToHsl = ([r, g, b]: Rgb): Hsl => {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    const l = (max + min) / 2;

    if (diff === 0) {
        return [0, 0, l];
    } else {
        const h =
            (max === r ? (g - b) / diff + (g < b ? 6 : 0) : (b - r) / diff + (max === g ? 2 : 4)) /
            6;
        const s = diff / (l > 0.5 ? 2 - max - min : max + min);

        return [h, s, l];
    }
};

function hueToRgbFragment(p: number, q: number, t: number) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
}

export const hslToRgb = ([h, s, l]: Hsl): Rgb => {
    let r, g, b;

    if (s === 0) {
        r = g = b = l; // achromatic
    } else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;

        r = hueToRgbFragment(p, q, h + 1 / 3);
        g = hueToRgbFragment(p, q, h);
        b = hueToRgbFragment(p, q, h - 1 / 3);
    }

    return [r * 255, g * 255, b * 255];
};

export const inverseColor = (c: number): number => 1 - c ** 2;

export const toHexFragment = (num: number, padWidth = 2) =>
    num.toString(16).padStart(padWidth, "0");

export const rgbToHex = (...rgb: Rgb): string => "#" + rgb.map(toHexFragment).join("");

export const random = (): string => "#" + toHexFragment(Math.trunc((1 << 24) * Math.random()), 6);
