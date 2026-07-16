import * as block from "@/core/block";
import {PostCache} from "./cache";
import type {PreviewRequest} from "./request";

export interface MiniPreviewState {
    element: HTMLDivElement;
    init: boolean;
    lastRequest: number;
    controller: AbortController;
    lastElement: EventTarget | null;
    lastTimeout: number;
    shouldOutHandle: boolean;
    cursorOut: boolean;
    isHovered: boolean;
}

export function createMiniPreview(): MiniPreviewState {
    const element = document.createElement("div");

    element.addEventListener("mouseenter", () => {
        state.isHovered = true;
    });
    element.addEventListener("mouseleave", () => {
        state.isHovered = false;
    });

    const state: MiniPreviewState = {
        element,
        init: false,
        lastRequest: 0,
        controller: new AbortController(),
        lastElement: null,
        lastTimeout: 0,
        shouldOutHandle: false,
        cursorOut: false,
        isHovered: false
    };

    return state;
}

export function miniPreviewCreate(
    state: MiniPreviewState,
    ev: MouseEvent,
    use: boolean,
    hide: boolean,
    interaction: boolean,
    getRelevantDataFn: (ev: MouseEvent) => GalleryPreData,
    postCaches: PostCache,
    request: PreviewRequest
): void {
    if (!use) return;

    state.cursorOut = false;

    if (Date.now() - state.lastRequest < 150) {
        state.lastRequest = Date.now();
        state.lastElement = ev.target;

        if (state.lastTimeout) clearTimeout(state.lastTimeout);

        state.lastTimeout = window.setTimeout(() => {
            if (!state.cursorOut && state.lastElement === ev.target) {
                miniPreviewCreate(state, ev, use, hide, interaction, getRelevantDataFn, postCaches, request);
            }
            state.cursorOut = false;
        }, 150);

        return;
    }

    state.lastRequest = Date.now();

    const preData = getRelevantDataFn(ev);
    if (!preData) return;

    state.element.classList.remove("hide");
    state.element.classList.add("refresher-mini-preview");

    if (!state.init) {
        if (interaction) {
            state.element.style.pointerEvents = "auto";
            state.element.style.overflow = "auto";
        }

        state.element.innerHTML = `<h3>${preData.title}</h3><br><div class="refresher-mini-preview-contents${
            hide ? " media-hide" : ""
        }"></div>${interaction ? "" : "<p class=read-more>더 읽으려면 클릭하세요.</p>"}`;
        document.body.appendChild(state.element);
        state.init = true;
    }

    const selector = state.element.querySelector(".refresher-mini-preview-contents");
    if (!selector) return;

    new Promise<IPostInfo>((resolve, reject) => {
        const cacheKey = PostCache.key(preData.gallery, preData.id);
        const cache = postCaches.get(cacheKey);

        if (cache?.post) {
            resolve(cache.post);
            return;
        }

        request
            .post(preData.link ?? "", preData.gallery, preData.id, state.controller.signal)
            .then((response) => {
                if (!response) {
                    reject();
                    return;
                }

                postCaches.set(cacheKey, {
                    date: Date.now(),
                    post: response
                });
                resolve(response);
            })
            .catch(reject);
    })
        .then((v) => {
            const dom = new DOMParser().parseFromString(v.contents!, "text/html");

            for (const element of dom.querySelectorAll("img[data-original]")) {
                element.setAttribute("src", element.getAttribute("data-original")!);
            }

            const content = dom.body.innerHTML;

            selector.innerHTML = block.check("TEXT", content) ? "게시글 내용이 차단됐습니다." : content;
            selector.querySelector(".write_div")?.setAttribute("style", "");
        })
        .catch((error) => {
            selector.innerHTML = String(error).includes("aborted")
                ? ""
                : `게시글을 새로 가져올 수 없습니다: ${error}`;
        });

    state.element.querySelector("h3")!.innerHTML = preData.title ?? "";
}

export function miniPreviewMove(state: MiniPreviewState, ev: MouseEvent, use: boolean, interaction: boolean): void {
    if (!use) return;

    const rect = state.element.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const x = Math.min(interaction ? ev.clientX + 10 : ev.clientX, innerWidth - width - 10);
    const y = Math.min(interaction ? ev.clientY - 50 : ev.clientY, innerHeight - height - 10);

    state.element.style.transform = `translate(${x}px, ${y}px)`;
}

export function miniPreviewClose(state: MiniPreviewState, use: boolean): void {
    if (state.isHovered) return;

    state.cursorOut = true;

    const h3 = state.element.querySelector("h3");
    if (h3) h3.innerHTML = "로딩 중...";

    const contents = state.element.querySelector(".refresher-mini-preview-contents");
    if (contents) contents.innerHTML = "로딩 중...";

    if (use) {
        state.controller.abort();
        state.controller = new AbortController();
    }

    state.element.classList.add("hide");
}