/** 그려진 프레임이 없으면 gif로 바꾸기까지 기다리는 시간 (디시 common.js의 DCCON_VIDEO_TIMEOUT). */
const TIMEOUT = 3000;

/** 떼어 내기만 하면 mp4를 계속 받는다. 소스를 비우고 load()로 받기를 끊고 플레이어를 놓는다. */
const stopLoading = (video: HTMLVideoElement): void => {
    video.removeAttribute("src");
    video.replaceChildren();
    video.load();
};

/** mp4를 gif로 바꾼다 - 차단 표시(data-blocked)도 옮겨야 가린 채로 남는다. */
const toGif = (video: HTMLVideoElement, gif: string): void => {
    const image = document.createElement("img");
    image.className = video.className;
    image.src = gif;
    // 스텔스, 이미지 차단으로 숨긴 것은 받지 않게 (utils/sanitize.ts와 같다).
    image.loading = "lazy";
    // 키보드로 누르는 버튼 표시(contentsClick.ts의 markPressable)도 옮긴다.
    for (const name of ["alt", "title", "data-block", "data-blocked", "tabindex", "role", "aria-label"]) {
        const value = video.getAttribute(name);
        if (value !== null) image.setAttribute(name, value);
    }
    video.replaceWith(image);
    stopLoading(video);
};

/** 깨진 mp4 움짤을 data-src의 gif로 바꾼다 - 오류 없이 프레임을 못 그리기도 해 3초 제한을 둔다. */
export const watchGifVideos = (root: HTMLElement): (() => void) => {
    const listeners = new AbortController();
    const timers: number[] = [];
    const videos = Array.from(root.querySelectorAll("video"));

    for (const video of root.querySelectorAll<HTMLVideoElement>("video[data-src]")) {
        const gif = video.dataset.src ?? "";
        let painted = false;
        video.requestVideoFrameCallback(() => (painted = true));

        // 이미 바꿨으면(문서에서 떨어졌으면) 다시 바꾸지 않는다.
        const fallback = (): void => {
            if (video.isConnected && !painted) toGif(video, gif);
        };
        // <source>의 error는 버블링되지 않아 캡처로 받는다.
        video.addEventListener("error", fallback, {capture: true, signal: listeners.signal});
        timers.push(window.setTimeout(fallback, TIMEOUT));
    }

    return () => {
        listeners.abort();
        for (const timer of timers) window.clearTimeout(timer);
        for (const video of videos) if (!video.isConnected) stopLoading(video);
    };
};
