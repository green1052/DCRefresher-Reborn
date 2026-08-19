export const enableVideoControls = (video: HTMLVideoElement): void => {
    const src = video.getAttribute("data-src");
    if (src?.includes("dcinside.com/dccon.php")) return;

    video.removeAttribute("onmousedown");
    video.setAttribute("controls", "");
};
