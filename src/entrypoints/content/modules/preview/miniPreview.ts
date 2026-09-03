import * as block from "@/core/block";
import {PostCache} from "./cache";
import {fetchPostWithCache} from "./request";
import {restoreImageSources} from "./postParser";

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
    closeTimeout: number;
    interaction: boolean;
    lastPostId: string;
}

export function createMiniPreview(): MiniPreviewState {
    const state: MiniPreviewState = {
        element: document.createElement("div"),
        init: false,
        lastRequest: 0,
        controller: new AbortController(),
        lastElement: null,
        lastTimeout: 0,
        shouldOutHandle: false,
        cursorOut: false,
        isHovered: false,
        closeTimeout: 0,
        interaction: false,
        lastPostId: ""
    };

    state.element.addEventListener("mouseenter", () => {
        state.isHovered = true;
        miniPreviewCancelClose(state);
    });
    state.element.addEventListener("mouseleave", () => {
        state.isHovered = false;

        // 요소 mouseleave는 이미 지나갔으므로 툴팁을 벗어나면 여기서 닫아야 한다.
        // 요소로 바로 복귀하는 경우를 위해 유예를 둔다.
        if (state.interaction && !state.element.classList.contains("hide")) {
            scheduleGraceClose(state);
        }
    });

    return state;
}

// 게시글 콘텐츠 파싱 (이미지 src 복원 + 차단 체크)
function parsePreviewContent(contents: string): string {
    const dom = new DOMParser().parseFromString(contents, "text/html");

    restoreImageSources(dom);

    const content = dom.body.innerHTML;
    return block.check("TEXT", content) ? "게시글 내용이 차단됐습니다." : content;
}

export function miniPreviewCreate(
    state: MiniPreviewState,
    ev: MouseEvent,
    use: boolean,
    hide: boolean,
    interaction: boolean,
    getRelevantDataFn: (ev: MouseEvent) => GalleryPreData,
    postCaches: PostCache
): void {
    if (!use) return;

    state.cursorOut = false;

    // 150ms 스로틀
    if (Date.now() - state.lastRequest < 150) {
        state.lastRequest = Date.now();
        state.lastElement = ev.target;

        if (state.lastTimeout) clearTimeout(state.lastTimeout);

        state.lastTimeout = window.setTimeout(() => {
            if (!state.cursorOut && state.lastElement === ev.target) {
                miniPreviewCreate(state, ev, use, hide, interaction, getRelevantDataFn, postCaches);
            }
            state.cursorOut = false;
        }, 150);

        return;
    }

    state.lastRequest = Date.now();

    const preData = getRelevantDataFn(ev);
    if (!preData) return;

    // 같은 글의 툴팁이 이미 열려 있으면 재요청/재배치하지 않음 (#257)
    if (!state.element.classList.contains("hide") && preData.id && preData.id === state.lastPostId) return;
    state.lastPostId = preData.id;

    state.element.classList.remove("hide");
    state.element.classList.add("refresher-mini-preview");

    if (!state.init) {
        state.interaction = interaction;

        if (interaction) {
            state.element.style.pointerEvents = "auto";
            state.element.style.overflow = "auto";
        }

        // 제목은 유저 입력이므로 아래에서 textContent로만 넣는다.
        state.element.innerHTML = `<h3></h3><br><div class="refresher-mini-preview-contents${
            hide ? " media-hide" : ""
        }"></div>${interaction ? "" : "<p class=read-more>더 읽으려면 클릭하세요.</p>"}`;
        document.body.appendChild(state.element);
        state.init = true;
    }

    const selector = state.element.querySelector(".refresher-mini-preview-contents");
    if (!selector) return;

    fetchPostWithCache(postCaches, preData, state.controller.signal, true)
        .then((v) => {
            selector.innerHTML = parsePreviewContent(v.contents!);
            selector.querySelector(".write_div")?.setAttribute("style", "");
        })
        .catch((error) => {
            selector.innerHTML = String(error).includes("aborted")
                ? ""
                : `게시글을 새로 가져올 수 없습니다: ${error}`;
        });

    state.element.querySelector("h3")!.textContent = preData.title ?? "";

    // 표시 직후 커서 위치로 즉시 이동 (hide 가드 때문에 이전 mousemove는 무시됐음)
    miniPreviewMove(state, ev, use, interaction);
}

export function miniPreviewMove(state: MiniPreviewState, ev: MouseEvent, use: boolean, interaction: boolean): void {
    if (!use) return;

    // 숨겨진 상태에선 mousemove마다 getBoundingClientRect(강제 리플로우)를 돌릴 필요 없음
    if (state.element.classList.contains("hide")) return;

    const rect = state.element.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const x = Math.min(interaction ? ev.clientX + 10 : ev.clientX, innerWidth - width - 10);
    const y = Math.min(interaction ? ev.clientY - 50 : ev.clientY, innerHeight - height - 10);

    state.element.style.transform = `translate(${x}px, ${y}px)`;
}

// 요소 mouseleave가 툴팁 mouseenter보다 먼저 발생하는 race 방지용 유예 (#257)
function scheduleGraceClose(state: MiniPreviewState): void {
    if (state.closeTimeout) return;

    state.cursorOut = true;
    state.closeTimeout = window.setTimeout(() => {
        state.closeTimeout = 0;
        miniPreviewClose(state, true, false);
    }, 150);
}

export function miniPreviewCancelClose(state: MiniPreviewState): void {
    if (state.closeTimeout) {
        window.clearTimeout(state.closeTimeout);
        state.closeTimeout = 0;
    }
}

export function miniPreviewClose(state: MiniPreviewState, use: boolean, interaction = false): void {
    if (state.isHovered) return;

    // 상호작용 툴팁은 커서가 요소에서 툴팁으로 이동하는 사이 닫히지 않도록 유예를 둔다.
    if (interaction && !state.element.classList.contains("hide")) {
        scheduleGraceClose(state);
        return;
    }

    miniPreviewCancelClose(state);

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