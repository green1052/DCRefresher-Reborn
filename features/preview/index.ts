import {HTTPError} from "ky";

import {isAbortError} from "@/utils/error";
import {defineModule} from "@/core/module/define";
import {getModuleApi} from "@/core/module/registry";
import type {GalleryPreData, PostInfo} from "@/core/preview/types";
import {useUiStore} from "@/stores/ui";
import {messageOf} from "@/utils/error";
import {isTyping, pressedKey} from "@/utils/event";
import {createDoublePress} from "@/utils/doublePress";
import {isGalleryManager} from "@/utils/user";
import {notifyManage} from "@/stores/notify";

import {getEntry, postKey} from "@/core/preview/cache";
import {historyDoc, ownPreviewDepth, ownPreviewEntry, type PreviewEntry} from "@/core/preview/history";
import {ADULT_ERROR, SECRET_ERROR} from "@/core/preview/parser";
import {blockCommenters, blockUser, type BlockOptions, bump, deletePost, fetchComments, setNotice, setRecommend} from "@/core/preview/request";
import {bindListKeys} from "./keyboard";
import meta, {type Ctx} from "./meta";
import {createCommentsPull} from "./commentsPull";
import {createPostLoader, cachedPost} from "./postLoader";
import {createPreviewHistory} from "./history";
import {createMini} from "./mini";
import {bindRows} from "./rows-input";
import {adjacentPreData, isTextPost} from "./rows";
import {type ErrorState, MANAGE_LABELS, type ManageKind, NO_FRESH, NO_HOOKS, usePreviewStore} from "./ui/previewStore";

// 성인 인증 안내 페이지면 parsePostInfo가 Error(ADULT_ERROR)를, 미니 갤러리 비밀글이면 Error(SECRET_ERROR)를 던진다.
const errorOf = (error: unknown): ErrorState => ({
    detail: messageOf(error),
    status: error instanceof HTTPError ? error.response.status : undefined,
    adult: error instanceof Error && error.message === ADULT_ERROR,
    secret: error instanceof Error && error.message === SECRET_ERROR
});

// 제목 링크의 첫 텍스트 노드만 읽는다. h1(로고)엔 인라인 스크립트가, 링크 전체엔 마이너, 미니 표시가 섞인다.
const galName = (): string => document.querySelector(".page_head h2 a")?.firstChild?.textContent?.trim() || "디시인사이드";

// 댓글은 쪽마다 요청이라 캐시로 연타를 막는다 - 이 시간(ms) 안에 받은 목록은 다시 받지 않는다.
const COMMENTS_REUSE = 10_000;

const recentComments = (preData: GalleryPreData) => {
    const entry = getEntry(preData);
    if (!entry?.comments || Date.now() - (entry.commentsAt ?? 0) >= COMMENTS_REUSE) return undefined;
    // 목록의 댓글 수가 더 많으면 새 댓글이니 다시 받는다 (줄어듦은 목록 수에 안 나와 판단 못 한다).
    return !entry.comments.truncated && preData.commentCount > entry.comments.list.length ? undefined : entry.comments;
};

const controller = (ctx: Ctx) => {
    const store = usePreviewStore;
    const ui = useUiStore.getState();

    let abort: AbortController | null = null;
    let refreshTimer = 0;
    let confirmPress = createDoublePress(1000);

    const posts = createPostLoader(ctx);
    const pull = createCommentsPull(ctx, () => abort?.signal);
    const nav = createPreviewHistory(ctx);
    const mini = createMini(ctx, posts.getPost, posts.processContents);

    /** 본문을 캐시 없이 다시 받고 댓글도 다시 받는다 - 같은 글이라 스크롤은 그대로다. */
    const reloadPost = async () => {
        const {visible, preData, signalId} = store.getState();
        if (!visible || !preData || !abort) return;

        try {
            const post = await posts.processContents(preData, await posts.requestPost(preData));
            if (store.getState().signalId !== signalId) return;
            store.setState({post, error: undefined, archived: false});
        } catch (e) {
            // 실패해도(삭제된 글 등) 보고 있던 본문은 그대로 둔다.
            if (isAbortError(e) || store.getState().signalId !== signalId) return;
            console.error("Preview reload failed:", e);
            ui.showToast("게시글을 다시 불러오지 못했습니다.", "error");
            return;
        }
        // 본문은 받았으니 댓글 실패는 댓글 실패로 알린다.
        await pull.refreshComments(true);
    };

    const load = async (preData: GalleryPreData, mySignal: number, dir: number) => {
        let post: PostInfo;
        let fresh: boolean;
        let archived: boolean;

        // 댓글도 함께 요청한다 - e_s_n_o는 갤러리마다 같아 페이지 값을 쓰고 본문과 맞을 때만 결과를 쓴다.
        const esno = document.querySelector<HTMLInputElement>("#e_s_n_o")?.value;
        // 방금 받은 댓글(COMMENTS_REUSE)은 그대로 쓰고 다시 받지 않는다. 캐시를 끄면 늘 받는다.
        const recent = ctx.settings.disableCache ? undefined : recentComments(preData);
        const early = !dir && !recent && preData.commentCount > 0 && esno && (ctx.settings.disableCache || !cachedPost(preData))
            ? fetchComments(preData, {esno}, abort!.signal).catch(() => undefined)
            : undefined;

        try {
            ({post, fresh, archived = false} = await posts.getPost(preData));
            post = await posts.processContents(preData, post);
        } catch (e) {
            if (store.getState().signalId !== mySignal) return;
            // 화면에는 ErrorBlock의 안내만 보이므로 원문은 콘솔에 남긴다.
            console.error("Preview load failed:", e);
            store.setState({error: errorOf(e)});
            return;
        }

        if (store.getState().signalId !== mySignal) return;
        store.setState({post, archived});

        try {
            // 캐시로 연 글은 받는 동안 지난번 댓글을 먼저 보인다 (같은 목록이면 다시 그리지 않는다).
            const last = recent ?? (fresh ? undefined : getEntry(preData)?.comments);
            // 캐시의 댓글은 본문과 한 번에 그려져, 댓글이 많으면 다 그릴 때까지 본문도 보이지 않는다. 본문을 한 프레임 먼저 그린다.
            if (last) await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve)));
            if (last) await pull.pullComments(preData, post, mySignal, false, last, true);
            if (!recent) {
                // 미리 받은 댓글은 같은 요청이었을 때만 쓴다. 비어 있으면 다시 받는다.
                const matches = post.esno === esno && (post.commentId ?? preData.gallery) === preData.gallery && (post.commentNo ?? preData.id) === preData.id;
                const given = early?.then((list) => (matches && list?.list.length ? list : undefined));
                // 댓글 0개면 받지 않되, 보존 댓글이 있거나 댓글 허용을 모르면 받는다.
                const skip = fresh && post.commentCount === 0 && !Object.keys(getEntry(preData)?.seen ?? {}).length && pull.hasAllowReply(preData.gallery);
                await pull.pullComments(preData, post, mySignal, skip, given);
            }
        } catch (e) {
            // 댓글만 못 받았으면 본문은 그대로 두고 댓글 칸에 '다시 시도' 안내를 보인다.
            if (store.getState().signalId === mySignal && !isAbortError(e)) {
                store.setState({commentsFailed: true});
                console.error("Comment load failed:", e);
                // 캐시의 지난 댓글을 보이고 있으면 안내가 뜨지 않으므로 토스트로 알린다.
                if (store.getState().comments !== undefined) ui.showToast("댓글을 불러오지 못했습니다.", "error");
            }
        }

        // 넘겼으면 다음 글 본문을 미리 받는다 - 받는 중인 요청이 있으면 끊기므로 미리 받지 않는다.
        if (dir && !ctx.settings.disableCache && store.getState().signalId === mySignal) {
            const next = adjacentPreData(preData, dir);
            if (next && !posts.hasPending() && !cachedPost(next)) void posts.requestPost(next);
        }
    };

    const close = (fromHistory = false) => {
        abort?.abort();
        abort = null;
        posts.abortPending();

        window.clearTimeout(refreshTimer);
        // 지난 글의 댓글 원본(수백 개면 수백 KB)을 다음 글을 열 때까지 들고 있지 않는다. 다음 글은 새 signalId라 어차피 다시 그린다.
        pull.forgetShown();

        nav.restore(fromHistory);
        store.getState().close();
    };

    // 창을 닫으면 건너뛴 목록 새로고침을 곧바로 한다 (삭제, 차단 뒤엔 refresh가 다시 받으므로 그대로 닫는다).
    const dismiss = (fromHistory = false) => {
        close(fromHistory);
        getModuleApi("refresh")?.catchUp();
    };

    /** dir: PageUp/Down, 스크롤로 넘긴 방향. 그 방향 다음 글을 미리 받는다. */
    const open = (preData: GalleryPreData, commentsOnly = false, historySkip = false, dir = 0) => {
        // 대기, 요청 중인 미니가 전체 미리보기 위에 뜨지 않게 한다.
        mini.onMiniLeave();

        const st = store.getState();

        if (st.visible && st.preData && postKey(st.preData) === postKey(preData)) {
            if (!st.error) {
                store.setState({commentsOnly});
                return;
            }
            // 오류 난 글을 다시 열면('다시 시도') 제자리에서 다시 받는다. 닫았다 열면 히스토리가 두 칸 쌓인다.
            historySkip = true;
        }

        abort?.abort();
        abort = new AbortController();
        window.clearTimeout(refreshTimer);
        // 두 번 누르기는 글마다 새로 센다. 이전 글에서 한 번 누른 키로 다음 글이 바로 지워지면 안 된다.
        confirmPress = createDoublePress(1000);

        store.getState().open(preData, {
            commentsOnly,
            // 목록에 이미지 아이콘이 없는 글만 본문 이미지를 숨긴다.
            imageBlocked: ctx.settings.blockImage && isTextPost(preData),
            adminVisible: ctx.settings.toggleAdminPanel && isGalleryManager()
        });

        const mySignal = store.getState().signalId;

        // 이미 열린 창에서 다음 글로 넘어갈 때는 처음 저장한 위치를 유지한다. 덮어쓰면 닫을 때 미리보기 주소로 되돌아간다.
        if (!historySkip && !st.visible) nav.remember({title: document.title, url: location.href, state: history.state});
        // 글 주소를 기록에 쌓으면 브라우저가 방문한 글로 쳐 목록 링크가 :Visited 색이 된다 (미리보기로 읽은 글 표시).
        if (ctx.settings.colorPreviewLink) {
            const newTitle = `${preData.title ?? document.title} - ${galName()}`;
            // back(돌아갈 위치)과 depth(닫을 때 그만큼 뒤로 감)도 넣는다 - 브라우저는 기록을 50개까지만 두므로 40칸부터는 바꾼다.
            if (!historySkip) {
                const depth = (st.visible ? ownPreviewDepth() : 0) + 1;
                const state: PreviewEntry = {refresher: 1, doc: historyDoc, preData, back: nav.back() ?? undefined, depth: Math.min(depth, 40)};
                // 기록 쌓기가 실패해도 창은 연다 - 끊기면 창이 멈춘 것처럼 보인다.
                try {
                    if (depth > 40) history.replaceState(state, newTitle, preData.link);
                    else history.pushState(state, newTitle, preData.link);
                } catch (e) {
                    console.error("미리보기 기록 쌓기 실패:", e);
                }
            }
            // 히스토리로 다시 열 때도 바꾼다 (popstate는 제목을 되돌리지 않는다).
            document.title = newTitle;
        }

        // 설정이 꺼져 있어도 타이머는 돌린다 - 실패가 이어지면 주기를 두 배씩 늘린다(최대 1분).
        let failures = 0;
        const scheduleRefresh = (): void => {
            const interval = ctx.settings.commentRefreshInterval;
            refreshTimer = window.setTimeout(async () => {
                if (ctx.settings.autoRefreshComment && !document.hidden && !pull.isPulling()) failures = (await pull.refreshComments()) ? 0 : failures + 1;
                if (store.getState().signalId === mySignal) scheduleRefresh();
            }, Math.min(interval * 2 ** failures, Math.max(interval, 60_000)));
        };
        scheduleRefresh();

        void load(preData, mySignal, dir);
    };

    // 관리 요청은 한 번에 하나만 보낸다. 패널을 연타해도 같은 POST가 두 번 가지 않는다.
    let managing = false;

    const manage = async (kind: ManageKind) => {
        const st = store.getState();
        // 목록에서 가져온 글 정보만 쓴다. 본문을 받는 중이거나 오류가 난 창에서도 관리할 수 있다.
        if (!st.preData || managing) return;

        const target = st.preData;
        // 응답 전에 다른 글로 넘어갔으면 공지, 개념글 표시는 바꾸지 않고 알림만 띄운다.
        const stillOpen = (): boolean => store.getState().signalId === st.signalId;
        managing = true;

        // 바뀐 상태를 기록에도 넣는다 - 옛 상태로 돌아오면 버튼이 반대로 보여 반대 요청이 나간다.
        const toggled = (field: "notice" | "recommend", value: boolean): void => {
            const preData = {...target, [field]: value};
            store.setState({preData});
            const entry = ownPreviewEntry(history.state);
            // 알림은 이미 떴다. 기록 고치기가 던지면 manage 끝의 목록 새로 고침을 건너뛰므로 replaceEntry가 삼킨다.
            if (entry?.preData?.id === target.id) nav.replaceEntry({...entry, preData});
        };

        const failure = "처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
        try {
            if (kind === "notice" || kind === "recommend") {
                const on = target[kind];
                const request = kind === "notice" ? setNotice(target, !on) : setRecommend(target, !on);
                if (await notifyManage(request, `${MANAGE_LABELS[kind][on ? 1 : 0]}했습니다.`, failure) && stillOpen()) toggled(kind, !on);
            } else if (kind === "delete") {
                // 지운 뒤에 닫는다. 먼저 닫으면 실패했을 때 보던 글이 사라진다. 그새 다른 글로 넘어갔으면 그 글은 두고 닫지 않는다.
                if (await notifyManage(deletePost(target), "게시글을 삭제했습니다.", failure) && stillOpen()) close();
            } else if (kind === "bump") {
                await notifyManage(bump(target), "게시글을 끌올했습니다.", failure);
            }
        } finally {
            managing = false;
        }

        void getModuleApi("refresh")?.reload();
    };

    // 차단 요청도 한 번에 하나만. 차단 키를 네 번 누르면(두 번씩 두 차례) 같은 사람을 두 번 차단한다.
    let blocking = false;

    /** 차단 키(프리셋)와 차단 창이 같이 쓴다. comments가 있으면 그 댓글 작성자를 차단한다. 글도 지웠으면 창을 닫는다. */
    const block = async (target: GalleryPreData, options: BlockOptions, comments?: string[]): Promise<boolean> => {
        if (blocking) return false;
        blocking = true;
        const signal = store.getState().signalId;
        try {
            const request = comments ? blockCommenters(target, comments, options) : blockUser(target, options);
            const blocked = await notifyManage(request, "차단했습니다.", "차단하지 못했습니다. 잠시 후 다시 시도해 주세요.");
            // 그새 다른 글로 넘어갔으면 창을 닫지 않는다. 댓글 차단은 창을 두고 고른 댓글을 비운 뒤 댓글을 다시 받는다.
            if (blocked && store.getState().signalId === signal) {
                if (comments) {
                    store.setState({selectedComments: NO_FRESH});
                    void pull.refreshComments();
                } else if (options.delChk) close();
            }
            void getModuleApi("refresh")?.reload();
            return blocked;
        } finally {
            blocking = false;
        }
    };

    const onKey = (ev: KeyboardEvent) => {
        // 크게 보기가 떠 있으면 키는 그 창 몫이다. 이미지를 보다 누른 키로 글이 지워지면 안 된다.
        if (!ctx.settings.useKeyPress || !store.getState().visible || store.getState().viewer) return;
        // Ctrl+D(북마크) 같은 조합키와 키를 누르고 있을 때의 반복 입력은 무시한다.
        if (ev.ctrlKey || ev.altKey || ev.metaKey || ev.repeat) return;

        // 설정값도 옵션 화면에서 같은 pressedKey로 받았으므로 그대로 비교한다.
        const key = pressedKey(ev);
        const isDelete = key === ctx.settings.deleteKey;
        if (!isDelete && key !== ctx.settings.blockKey) return;

        if (isTyping(ev) || !isGalleryManager()) return;

        if (confirmPress(key)) {
            ev.preventDefault();
            const {preData} = store.getState();
            if (isDelete) void manage("delete");
            else if (preData) {
                const {blockPresetDay, blockPresetReason, blockPresetDelete, blockPresetUserType} = ctx.settings;
                void block(preData, {avoidHour: blockPresetDay, avoidReason: "0", avoidReasonTxt: blockPresetReason, delChk: blockPresetDelete, userTypeChk: blockPresetUserType});
            }
        } else {
            ui.showToast(`한 번 더 ${key.toUpperCase()} 키를 누르면 ${isDelete ? "게시글을 삭제" : "작성자를 차단"}합니다.`);
        }
    };

    const onPopState = (ev: PopStateEvent) => {
        // 이 문서에서 쌓은 항목이면 창이 열려 있어도 그 글을 연다. PageDown으로 넘긴 뒤 뒤로 가면 이전 글이 열린다.
        const state = ownPreviewEntry(ev.state);
        if (state?.preData) {
            nav.setBack(state.back ?? null);
            open(state.preData, false, true);
            return;
        }

        if (store.getState().visible) dismiss(true);
    };

    bindListKeys(ctx, (preData) => open(preData));

    bindRows(ctx, {
        open: (preData, commentsOnly) => open(preData, commentsOnly),
        // 캐시를 끄면 열 때 캐시를 보지 않는다. 떼기 전에 다 받으면 한 번 더 받게 되므로 미리 받지 않는다.
        prefetch: (preData) => {
            if (!ctx.settings.disableCache && !cachedPost(preData)) void posts.requestPost(preData);
        },
        mini
    });

    window.addEventListener("keydown", onKey, {signal: ctx.signal});
    window.addEventListener("popstate", onPopState, {signal: ctx.signal});

    nav.reopenFromEntry((preData) => open(preData, false, true));

    ctx.addCleanup(() => {
        // 문서의 mouseout 리스너가 떨어지면 떠 있거나 받는 중인 미니를 닫을 길이 없어 여기서 닫는다.
        mini.onMiniLeave();
        close();
        store.setState(NO_HOOKS);
    });

    store.setState({
        requestOpen: (preData, commentsOnly, dir) => open(preData, commentsOnly, false, dir),
        requestClose: () => dismiss(),
        requestRefresh: async (report) => {
            await pull.refreshComments(report);
        },
        requestReload: () => reloadPost(),
        requestManage: (kind) => void manage(kind),
        requestBlock: block
    });
};

/** 다른 모듈이 쓰는 미리보기 api (getModuleApi("preview")). */
interface PreviewApi {
    /** '삭제된 글과 댓글 보존' 설정. 새로고침 모듈도 목록에서 지워진 글을 남길지 이것으로 정한다. */
    archiveArticle(): boolean;

    /** 미리보기 창이 열려 있는지. 열린 동안 새로고침 모듈은 가려진 목록을 자동으로 받지 않는다. */
    isOpen(): boolean;
}

export default defineModule(meta, {
    setup: (ctx): PreviewApi => {
        controller(ctx);
        return {archiveArticle: () => ctx.settings.archiveArticle, isOpen: () => usePreviewStore.getState().visible};
    }
});
