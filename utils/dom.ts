/** DOMContentLoaded에 run을 부른다. signal이 abort되면 부르지 않는다. */
export const whenDomReady = (run: () => void, signal?: AbortSignal): void => {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run, {once: true, signal});
    else run();
};

/** 요소 글자 - 디시가 제목 칸 등에 넣은 <script>는 실행된 뒤에도 남아 textContent에 소스가 붙으므로, 바로 아래 <script> 글자는 뺀다. */
export const textWithoutScripts = (element: Element | null | undefined): string =>
    element ? Array.from(element.childNodes, (node) => (node.nodeName === "SCRIPT" ? "" : node.textContent)).join("").trim() : "";

/** bfcache 복귀 탭은 저장소 변경을 못 받았으니 돌아올 때 다시 읽는다. */
export const onBfcacheRestore = (run: () => Promise<void>, signal?: AbortSignal): void => {
    window.addEventListener("pageshow", (ev) => {
        if (ev.persisted) void run().catch(console.error);
    }, {signal});
};

/** 부드러운 스크롤(맨 위로, 댓글로, 페이지 넘김 등). 동작 줄이기(prefers-reduced-motion)를 켰으면 바로 옮긴다. */
export const smoothScroll = (): ScrollBehavior => (matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");

/** id인 <style>에 쓴다(없으면 만든다). document_start엔 head가 없을 수 있고, 재주입 인스턴스의 style도 이어 쓴다. */
export const writeStyle = (id: string, css: string): (() => void) => {
    const style = document.querySelector<HTMLStyleElement>(`style#${id}`)
        ?? document.documentElement.appendChild(Object.assign(document.createElement("style"), {id}));
    style.textContent = css;
    return () => style.remove();
};
