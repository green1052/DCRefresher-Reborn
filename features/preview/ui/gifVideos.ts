/** 그려진 프레임이 없으면 gif로 바꾸기까지 기다리는 시간 (디시 common.js의 DCCON_VIDEO_TIMEOUT). */
const TIMEOUT = 3000;

/** 떼어 내기만 하면 mp4를 계속 받는다. 소스를 비우고 load()로 받기를 끊고 플레이어를 놓는다. */
const stopLoading = (video: HTMLVideoElement): void => {
    video.removeAttribute("src");
    video.replaceChildren();
    video.load();
};

/**
 * 디시 common.js의 dccon_video_to_gif처럼 클래스·alt·title을 옮긴 gif로 바꾼다. 관리자 가림(data-block)과 차단 표시(data-blocked, blockedDccons.ts)도 옮겨야 가린 채로 남는다.
 * 숨긴 차단 디시콘은 프레임을 그리지 않아 늘 바뀐다.
 * 디시가 함께 옮기는 conalt는 정화에서 빠져 없다.
 */
const toGif = (video: HTMLVideoElement, gif: string): void => {
    const image = document.createElement("img");
    image.className = video.className;
    image.src = gif;
    // 스텔스·이미지 차단으로 숨긴 것은 받지 않게 (utils/sanitize.ts와 같다).
    image.loading = "lazy";
    for (const name of ["alt", "title", "data-block", "data-blocked"]) {
        const value = video.getAttribute(name);
        if (value !== null) image.setAttribute(name, value);
    }
    video.replaceWith(image);
    stopLoading(video);
};

/**
 * 디시콘·본문 움짤의 mp4가 깨졌으면 디시처럼 data-src의 gif로 바꾼다 (디시 common.js의 watch_dccon_video).
 * 디시는 <source onerror>로도 바꾸는데 그 속성은 정화에서 빠진다. 깨진 mp4는 오류 없이 한 프레임도 그리지 못하기도 해서
 * 3초 안에 그려진 프레임이 없어도 바꾼다.
 * gif는 같은 그림이라 멀쩡한 영상(숨겨 두어 그리지 않은 것 등)을 바꿔도 보이는 것은 같다.
 * 정리할 때는 창을 닫았거나 다른 글로 넘어가 문서에서 빠진 영상의 받기를 끊는다.
 */
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
