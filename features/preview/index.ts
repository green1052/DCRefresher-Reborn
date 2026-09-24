import {eventBus} from "@/core/eventbus/bus";
import {block} from "@/core/block";
import type {ModuleContext, ModuleDefinition} from "@/core/module/types";
import type {GalleryPreData, IPostInfo} from "@/features/types";
import {useUiStore} from "@/stores/ui";

import {getEntry, setEntry, type DcinsideComment} from "@/core/preview/cache";
import {processComments} from "@/core/preview/comments";
import {bump, blockUser, deletePost, fetchComments, fetchPost, setNotice, setRecommend} from "@/core/preview/request";
import {usePreviewStore, type ErrorState, type ManageKind} from "./ui/previewStore";

const settings: NonNullable<ModuleDefinition["settings"]> = {
    tooltipMode: {type: "check", name: "미니 미리보기 표시", desc: "게시글에 마우스를 올리면 미리보기를 표시합니다.", default: false},
    tooltipMediaHide: {type: "check", name: "미니 미리보기 미디어 숨기기", desc: "미니 미리보기에서 이미지와 동영상을 숨깁니다.", default: false},
    tooltipDelay: {type: "range", name: "미니 미리보기 딜레이", desc: "미니 미리보기가 표시되기까지의 지연 시간입니다.", default: 0, min: 0, max: 1000, step: 50, unit: "ms"},
    tooltipInteraction: {type: "check", name: "미니 미리보기 상호작용", desc: "미니 미리보기 위에서 마우스를 사용할 수 있게 합니다.", default: false},
    tooltipRatioDisable: {type: "check", name: "미니 미리보기 글/댓글 비율 강조 비활성화", desc: "미니 미리보기의 글/댓글 비율 강조를 끕니다.", default: false},
    reversePreviewKey: {type: "check", name: "미리보기 키 반전", desc: "좌클릭으로 미리보기, 우클릭으로 게시글 이동을 사용합니다.", default: false},
    longPressDelay: {type: "range", name: "길게 누르기 판정 시간", desc: "이 시간보다 짧게 누르면 미리보기가 열립니다.", default: 300, min: 200, max: 2000, step: 50, unit: "ms"},
    colorPreviewLink: {type: "check", name: "게시글 URL 변경", desc: "미리보기로 본 게시글의 주소와 제목을 변경합니다.", default: true},
    autoRefreshComment: {type: "check", name: "댓글 자동 새로고침", desc: "일정 주기로 댓글을 자동으로 새로고침합니다.", default: false},
    commentRefreshInterval: {type: "range", name: "댓글 자동 새로고침 주기", desc: "댓글 자동 새로고침 주기입니다.", default: 10000, min: 3000, max: 20000, step: 100, unit: "ms"},
    toggleBlur: {type: "check", name: "게시글 배경 블러", desc: "게시글 배경을 흐리게 표시합니다.", default: true},
    toggleBackgroundBlur: {type: "check", name: "바깥 배경 블러", desc: "미리보기 바깥 배경을 흐리게 표시합니다.", default: false},
    toggleAdminPanel: {type: "check", name: "관리 패널 활성화", desc: "관리 권한이 있을 때 관리 패널을 표시합니다.", default: true},
    useKeyPress: {type: "check", name: "단축키로 댓글 관리", desc: "D/B 키로 빠르게 삭제/차단합니다.", default: true},
    blockPresetDay: {type: "option", name: "차단 프리셋 - 차단 기간", desc: "B키 단축 차단의 기본 차단 기간입니다.", default: "1", items: {"1": "1시간", "6": "6시간", "24": "1일", "168": "7일", "336": "14일", "744": "31일"}},
    blockPresetReason: {type: "text", name: "차단 프리셋 - 차단 사유", desc: "B키 단축 차단의 기본 차단 사유입니다. (한글 20자 이내)", default: "", placeholder: "차단 사유 직접 입력 (한글 20자 이내)"},
    blockPresetDelete: {type: "check", name: "차단 프리셋 - 선택한 글 삭제", desc: "B키 단축 차단 시 게시글도 함께 삭제합니다.", default: false},
    blockPresetUserType: {type: "check", name: "차단 프리셋 - IP 동시 차단", desc: "B키 단축 차단 시 식별 코드 차단과 함께 IP도 차단합니다.", default: false},
    expandRecognizeRange: {type: "check", name: "게시글 인식 범위 확장", desc: "행 전체를 클릭해도 미리보기가 열리게 합니다.", default: false},
    experimentalComment: {type: "check", name: "실험적 댓글 기능", desc: "실험적 댓글 기능을 활성화합니다.", default: false},
    disableCache: {type: "check", name: "캐시 비활성화", desc: "미리보기 캐시를 사용하지 않습니다.", default: false},
    archiveArticle: {type: "check", name: "삭제된 글과 댓글 보존", desc: "캐시된 게시글이 삭제되어도 이전 내용을 보여줍니다.", default: false},
    blockImage: {type: "check", name: "이미지가 없는 게시글 이미지 차단", desc: "본문 이미지를 기본으로 숨깁니다. 미리보기에서 버튼으로 다시 볼 수 있습니다.", default: false}
};

export const buildPreData = (element: HTMLElement): GalleryPreData | null => {
    const anchor = element.tagName === "A" ? (element as HTMLAnchorElement) : element.querySelector<HTMLAnchorElement>("a:not(.reply_numbox)");
    if (!anchor) return null;

    const href = anchor.getAttribute("href");
    if (!href) return null;

    const url = new URL(href, location.origin);
    let gallery = url.searchParams.get("id") ?? undefined;
    let id = url.searchParams.get("no") ?? undefined;

    if (!gallery || !id) {
        const path = /\/board\/view\/(?:id\/)?([^/]+)\/(\d+)/.exec(url.pathname);
        if (!path) return null;
        gallery = path[1];
        id = path[2];
    }

    const row = (element.closest(".ub-content") as HTMLElement | null) ?? element;

    return {
        gallery: gallery ?? "",
        id: id ?? "",
        title: anchor.textContent?.trim() || undefined,
        link: url.href,
        notice: Boolean(row.querySelector(".icon_notice")),
        recommend: Boolean(row.querySelector(".icon_recomimg")),
        type: ""
    };
};

const errorOf = (error: unknown): ErrorState => ({detail: error instanceof Error ? error.message : String(error)});

const controller = (ctx: ModuleContext) => {
    const store = usePreviewStore;
    const ui = useUiStore.getState();

    let abort: AbortController | null = null;
    let savedHistory: {title: string; url: string; state: unknown} | null = null;
    let refreshTimer = 0;
    let pressStart = 0;
    let lastKey = "";
    let lastKeyTime = 0;
    let miniTimer = 0;
    let lastMiniAt = 0;
    let lastMiniId = "";

    const galName = (): string => document.querySelector("h1")?.textContent?.trim() || "디시인사이드";

    const processContents = (preData: GalleryPreData, postInfo: IPostInfo): IPostInfo => {
        const raw = postInfo.contents ?? "";

        if (block.checkAll({TEXT: raw.replace(/<[^>]+>/g, " ").trim()}, preData.gallery)) {
            return {...postInfo, contents: "게시글 내용이 차단됐습니다."};
        }

        const contents = raw
            .replace(/ (style|onmousedown|onmouseout|onmouseover)="[^"]*"/g, "")
            .replaceAll("<video", "<video controls");

        return {...postInfo, contents};
    };

    const applyComments = (preData: GalleryPreData, raw: DcinsideComment[]) => {
        const {list, threads, totalCnt} = processComments(raw, preData, ctx);
        store.getState().setComments(list, totalCnt, `쓰레드 ${threads}개, 총 댓글 ${totalCnt}개`);
    };

    const loadComments = async (preData: GalleryPreData, postInfo: IPostInfo, mySignal: number) => {
        if (postInfo.commentCount === 0) {
            store.getState().setComments([], 0, "쓰레드 0개, 총 댓글 0개");
            return;
        }

        const useCache = ctx.settings.disableCache !== true;
        const cached = useCache ? getEntry(preData)?.comment : undefined;

        if (cached && String(cached.total_cnt) === String(postInfo.commentCount)) {
            if (store.getState().signalId !== mySignal) return;
            applyComments(preData, cached.list);
            return;
        }

        const response = await fetchComments(preData, postInfo, abort!.signal);
        if (store.getState().signalId !== mySignal) return;

        setEntry(preData, {comment: response});
        applyComments(preData, response.list);
    };

    const refreshComments = async () => {
        const st = store.getState();
        if (!st.visible || !st.preData || !st.post || !abort) return;

        try {
            const response = await fetchComments(st.preData, st.post, abort.signal);
            if (store.getState().signalId !== st.signalId) return;
            setEntry(st.preData, {comment: response});
            applyComments(st.preData, response.list);
        } catch {
            // 자동 갱신 실패는 조용히 무시
        }
    };

    const load = async (preData: GalleryPreData, mySignal: number) => {
        try {
            const useCache = ctx.settings.disableCache !== true;
            let postInfo = useCache ? getEntry(preData)?.post : undefined;

            if (!postInfo) {
                postInfo = await fetchPost(preData, abort!.signal);
                setEntry(preData, {post: postInfo});
            }

            if (store.getState().signalId !== mySignal) return;

            const processed = processContents(preData, postInfo);
            store.getState().setPost(processed);
            eventBus.emit("postDataLoaded", processed);
            eventBus.emit("postCommentIdLoaded", processed.commentId, processed.commentNo);

            await loadComments(preData, processed, mySignal);
        } catch (error) {
            if (store.getState().signalId !== mySignal) return;
            store.getState().setError(errorOf(error));
        }
    };

    const restoreHistory = () => {
        if (!savedHistory || ctx.settings.colorPreviewLink !== true) {
            savedHistory = null;
            return;
        }

        history.pushState(savedHistory.state, savedHistory.title, savedHistory.url);
        document.title = savedHistory.title;
        savedHistory = null;
    };

    const close = (fromHistory = false) => {
        abort?.abort();
        abort = null;

        if (refreshTimer) window.clearInterval(refreshTimer);
        refreshTimer = 0;
        if (miniTimer) window.clearTimeout(miniTimer);
        miniTimer = 0;

        if (!fromHistory) restoreHistory();
        store.getState().close();
    };

    const open = (preData: GalleryPreData, commentsOnly = false, historySkip = false) => {
        const st = store.getState();

        if (st.visible && st.preData?.id === preData.id && st.preData?.gallery === preData.gallery) {
            st.setCommentsOnly(commentsOnly);
            return;
        }

        abort?.abort();
        abort = new AbortController();
        if (refreshTimer) window.clearInterval(refreshTimer);
        refreshTimer = 0;

        store.getState().open(preData);

        const mySignal = store.getState().signalId;
        const after = store.getState();

        if (commentsOnly) after.setCommentsOnly(true);
        after.setImageBlocked(ctx.settings.blockImage === true);
        after.setNotice(Boolean(preData.notice));
        after.setRecommend(Boolean(preData.recommend));
        after.setAdminVisible(Boolean(ctx.settings.toggleAdminPanel) && Boolean(document.querySelector(".useradmin_btnbox button")));

        if (!historySkip) {
            savedHistory = {title: document.title, url: location.href, state: history.state};
            if (ctx.settings.colorPreviewLink) {
                const newTitle = `${preData.title ?? document.title} - ${galName()}`;
                history.pushState({refresher: 1, preData}, newTitle, preData.link);
                document.title = newTitle;
            }
        }

        if (ctx.settings.autoRefreshComment === true) {
            const interval = Number(ctx.settings.commentRefreshInterval) || 10000;
            refreshTimer = window.setInterval(() => {
                if (document.hidden) return;
                void refreshComments();
            }, interval);
        }

        void load(preData, mySignal);
    };

    const handleManageResponse = (response: unknown) => {
        if (!response || typeof response !== "object") return;

        const {msg, result} = response as {msg?: string; result?: string};
        if (typeof msg !== "string" || !msg) return;

        ui.showToast(msg, result === "success" ? "info" : "error");
    };

    const manage = async (kind: ManageKind) => {
        const st = store.getState();
        if (!st.preData || !st.post) return;

        const target = st.preData;

        try {
            if (kind === "notice") {
                const response = await setNotice(target, !st.notice);
                store.getState().setNotice(!st.notice);
                handleManageResponse(response);
            } else if (kind === "recommend") {
                const response = await setRecommend(target, !st.recommend);
                store.getState().setRecommend(!st.recommend);
                handleManageResponse(response);
            } else if (kind === "delete") {
                close();
                await deletePost(target);
            } else if (kind === "bump") {
                handleManageResponse(await bump(target));
            }
        } catch {
            ui.showToast("관리 기능 처리 중 오류가 발생했습니다.", "error");
        }

        eventBus.emit("refreshRequest");
    };

    const blockPreset = async (target: GalleryPreData) => {
        try {
            await blockUser(target, {
                avoidHour: String(ctx.settings.blockPresetDay ?? "1"),
                avoidReason: "0",
                avoidReasonTxt: String(ctx.settings.blockPresetReason ?? ""),
                delChk: ctx.settings.blockPresetDelete ? "1" : "0",
                userTypeChk: ctx.settings.blockPresetUserType ? "1" : "0"
            });

            ui.showToast("차단이 처리되었습니다.");
            if (ctx.settings.blockPresetDelete) close();
        } catch {
            ui.showToast("차단 처리 중 오류가 발생했습니다.", "error");
        }

        eventBus.emit("refreshRequest");
    };

    const onKey = (event: KeyboardEvent) => {
        if (ctx.settings.useKeyPress !== true || !store.getState().visible) return;

        const key = event.key.toLowerCase();
        if (key !== "d" && key !== "b") return;

        const target = event.target;
        if (target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;

        const now = Date.now();

        if (lastKey === key && now - lastKeyTime < 1000) {
            lastKey = "";
            event.preventDefault();
            void (key === "d" ? manage("delete") : store.getState().preData && blockPreset(store.getState().preData!));
        } else {
            lastKey = key;
            lastKeyTime = now;
            ui.showToast(key === "d" ? "한번 더 D키를 누르면 게시글을 삭제합니다." : "한번 더 B키를 누르면 게시글을 차단합니다.");
        }
    };

    const onPopState = (event: PopStateEvent) => {
        const st = store.getState();

        if (st.visible) {
            close(true);
            return;
        }

        const state = event.state as {refresher?: number; preData?: GalleryPreData} | null;
        if (state?.refresher === 1 && state.preData) {
            open(state.preData, false, true);
        }
    };

    // ── 미니 미리보기 ────────────────────────────────────────────
    const showMini = (element: HTMLElement, x: number, y: number) => {
        const st = store.getState();
        if (!st.preData && !element) return;

        const preData = element.closest(".ub-content") instanceof HTMLElement || element.tagName === "A" ? buildPreData(element) : null;
        if (!preData) return;

        if (preData.id === lastMiniId && Date.now() - lastMiniAt < 150) return;

        const post = getEntry(preData)?.post;
        if (!post) return;

        let contents = post.contents ?? "";
        if (block.checkAll({TEXT: contents.replace(/<[^>]+>/g, " ").trim()}, preData.gallery)) {
            contents = "게시글 내용이 차단됐습니다.";
        } else if (ctx.settings.tooltipMediaHide === true) {
            contents = contents.replace(/<(img|video|iframe|audio|embed|source)[^>]*>/g, "").replace(/<\/(video|iframe|audio|source)>/g, "");
        }

        lastMiniAt = Date.now();
        lastMiniId = preData.id;

        st.closeMini();
        st.openMini({
            preData,
            x: Math.max(0, Math.min(x + 16, window.innerWidth - 340)),
            y: Math.max(0, Math.min(y + 16, window.innerHeight - 220)),
            title: post.header ? `[${post.header}] ${post.title ?? ""}` : (post.title ?? ""),
            contents
        });
    };

    const onMiniEnter = (event: MouseEvent) => {
        if (ctx.settings.tooltipMode !== true) return;
        if (store.getState().visible) return;

        const element = event.currentTarget as HTMLElement;
        const x = event.clientX;
        const y = event.clientY;

        if (miniTimer) window.clearTimeout(miniTimer);
        const delay = Number(ctx.settings.tooltipDelay) || 0;
        miniTimer = window.setTimeout(() => showMini(element, x, y), delay);
    };

    const onMiniLeave = () => {
        if (miniTimer) window.clearTimeout(miniTimer);
        miniTimer = 0;
        if (ctx.settings.tooltipInteraction !== true) store.getState().closeMini();
    };

    // ── 행 이벤트 ────────────────────────────────────────────────
    const onMouseDown = (event: MouseEvent) => {
        if (event.button !== 2) return;
        pressStart = Date.now();
    };

    const onContextMenu = (event: MouseEvent) => {
        const element = event.currentTarget as HTMLElement;
        const target = event.target as HTMLElement;

        // 댓글 수 링크 → 댓글만 보기 (행 모드 가드보다 먼저)
        if (target.closest(".reply_numbox")) {
            const preData = buildPreData(element);
            if (preData) {
                event.preventDefault();
                open(preData, true);
            }
            return;
        }

        if (element.dataset.refresherPreviewMode === "row" && ctx.settings.expandRecognizeRange !== true) return;

        const preData = buildPreData(element);
        if (!preData) return;

        if (ctx.settings.reversePreviewKey === true) {
            event.preventDefault();
            location.href = preData.link ?? location.href;
            return;
        }

        if (Date.now() - pressStart < (Number(ctx.settings.longPressDelay) || 300)) {
            event.preventDefault();
            open(preData);
        }
    };

    const onClick = (event: MouseEvent) => {
        const element = event.currentTarget as HTMLElement;
        const target = event.target as HTMLElement;

        // 댓글 수 링크 → 댓글만 보기 (행 모드 가드보다 먼저)
        if (target.closest(".reply_numbox")) {
            const preData = buildPreData(element);
            if (preData) {
                event.preventDefault();
                open(preData, true);
            }
            return;
        }

        if (element.dataset.refresherPreviewMode === "row" && ctx.settings.expandRecognizeRange !== true) return;

        if (target.closest(".ub-writer")) return;

        const preData = buildPreData(element);
        if (!preData) return;

        if (ctx.settings.reversePreviewKey === true) {
            event.preventDefault();
            open(preData);
        }
    };

    const bind = (element: HTMLElement, mode: "word" | "row") => {
        if (element.dataset.refresherPreviewBound === "1") return;
        element.dataset.refresherPreviewBound = "1";
        element.dataset.refresherPreviewMode = mode;

        element.addEventListener("mousedown", onMouseDown);
        element.addEventListener("contextmenu", onContextMenu);
        element.addEventListener("click", onClick);

        if (mode === "word") {
            element.addEventListener("mouseenter", onMiniEnter);
            element.addEventListener("mouseleave", onMiniLeave);
        }
    };

    ctx.addFilter(
        ".gall_list .ub-word",
        (element) => bind(element, "word"),
        {neverExpire: true}
    );

    ctx.addFilter(
        ".gall_list .ub-content",
        (element) => bind(element, "row"),
        {neverExpire: true}
    );

    window.addEventListener("keydown", onKey);
    window.addEventListener("popstate", onPopState);

    ctx.addCleanup(() => {
        window.removeEventListener("keydown", onKey);
        window.removeEventListener("popstate", onPopState);
        close();
    });

    store.getState().setHooks({open, close: () => close(), refresh: () => void refreshComments(), manage: (kind) => void manage(kind)});
};

const previewModule: ModuleDefinition = {
    id: "preview",
    name: "미리보기",
    description: "글 목록에서 클릭 또는 우클릭으로 미리보기 창을 띄워줍니다.",
    defaultEnable: true,
    urls: [/gall\.dcinside\.com/],
    settings,
    setup: (ctx) => {
        controller(ctx);
    }
};

export default previewModule;
