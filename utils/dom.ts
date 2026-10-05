/** 문서를 다 읽었으면 바로, 읽는 중이면 DOMContentLoaded에 run을 부른다. signal이 abort되면 기다리던 호출은 부르지 않는다. */
export const whenDomReady = (run: () => void, signal?: AbortSignal): void => {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run, {once: true, signal});
    else run();
};

/** bfcache에서 돌아온 탭은 그사이의 저장소 변경을 받지 못했다. 돌아올 때 run으로 다시 읽는다. 컨텍스트가 무효화되면 저장소를 부를 수 없으므로 signal로 리스너를 뗀다. */
export const onBfcacheRestore = (run: () => Promise<void>, signal?: AbortSignal): void => {
    window.addEventListener("pageshow", (ev) => {
        if (ev.persisted) void run().catch(console.error);
    }, {signal});
};

/** 부드러운 스크롤(맨 위로·댓글로·페이지 넘김 등). 동작 줄이기(prefers-reduced-motion)를 켰으면 바로 옮긴다. */
export const smoothScroll = (): ScrollBehavior => (matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");

/**
 * id인 <style>에 css를 쓴다. 없으면 만든다. 콘텐츠 스크립트는 document_start에 돌아 head가 없을 수 있으므로 <html>에 붙인다.
 * 죽은 인스턴스(파이어폭스 재주입)가 남긴 style도 id로 찾아 이어 쓴다. 새로 붙이면 옛 규칙이 끌 수 없게 남는다.
 */
export const writeStyle = (id: string, css: string): void => {
    const style = document.querySelector<HTMLStyleElement>(`style#${id}`)
        ?? document.documentElement.appendChild(Object.assign(document.createElement("style"), {id}));
    style.textContent = css;
};
