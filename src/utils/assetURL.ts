export function getAssetURL(name: string): string {
    return browser.runtime.getURL(`/assets/${name}.webp` as never);
}

export function getAssetPath(name: string): string {
    return `/assets/${name}`;
}