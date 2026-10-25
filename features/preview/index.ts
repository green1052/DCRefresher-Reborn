import {HTTPError} from "ky";
import {shallow} from "zustand/shallow";

import {blockMode, duplicateOf, isBlocked} from "@/core/block";
import {isAbortError} from "@/core/http/client";
// 정적 import: 파이어폭스는 콘텐츠 스크립트가 늦게 하는 동적 import(청크)를 페이지를 다시 읽은 직후에 못 읽는다.
import {prepareComments, processComments, sameComments} from "@/core/preview/comments";
import {sanitizeHtml} from "@/utils/sanitize";
import {defineModule} from "@/core/module/define";
import {getModuleApi, moduleSettingsStore, runningModuleSettings, runningModulesStore} from "@/core/module/registry";
import type {ModuleSettings} from "@/core/module/types";
import type {ProcessedComment} from "@/core/preview/comments";
import type {CommentListResponse, DcinsideComment, GalleryPreData, PostInfo} from "@/core/preview/types";
import {useBlocksStore} from "@/stores/blocks";
import {lowActivityOf, useUiStore} from "@/stores/ui";
import {whenDomReady} from "@/utils/dom";
import {isBlockedError, messageOf} from "@/utils/error";
import {isTyping, pressedKey} from "@/utils/event";
import {createDoublePress} from "@/utils/doublePress";
import {isGalleryManager} from "@/utils/user";
import {notifyManage} from "@/stores/notify";

import {getEntry, postKey, setEntry} from "@/core/preview/cache";
import {historyDoc, ownPreviewDepth, ownPreviewEntry, previewEntry, type PreviewEntry, type SavedHistory} from "@/core/preview/history";
import {ADULT_ERROR, SECRET_ERROR} from "@/core/preview/parser";
import {blockCommenters, blockUser, type BlockOptions, bump, deletePost, fetchComments, fetchPost, setNotice, setRecommend} from "@/core/preview/request";
import {bindListKeys} from "./keyboard";
import meta, {type Ctx} from "./meta";
import {createMini} from "./mini";
import {bindRows} from "./rows-input";
import {adjacentPreData, isTextPost} from "./rows";
import {type ErrorState, MANAGE_LABELS, type ManageKind, NO_FRESH, NO_HOOKS, NO_REPLY, usePreviewStore} from "./ui/previewStore";

// 성인 인증 안내 페이지면 parsePostInfo가 Error(ADULT_ERROR)를, 미니 갤러리 비밀글이면 Error(SECRET_ERROR)를 던진다.
const errorOf = (error: unknown): ErrorState => ({
    detail: messageOf(error),
    // 임시 차단(빈 페이지)은 200으로 오므로 요청 제한(429)으로 본다.
    status: error instanceof HTTPError ? error.response.status : isBlockedError(error) ? 429 : undefined,
    adult: error instanceof Error && error.message === ADULT_ERROR,
    secret: error instanceof Error && error.message === SECRET_ERROR
});

// 제목 링크의 첫 텍스트 노드만 읽는다. h1(로고)엔 인라인 스크립트가, 링크 전체엔 마이너·미니 표시가 섞인다.
const galName = (): string => document.querySelector(".page_head h2 a")?.firstChild?.textContent?.trim() || "디시인사이드";

// 본문 차단은 차단 모듈 설정을 따르고, 모듈이 꺼져 있으면 가리지 않는다.
// 원문은 지우지 않아 '가린 내용 보기'로 다시 볼 수 있다 (Frame.tsx).
const textBlockOf = (preData: GalleryPreData, postInfo: PostInfo): PostInfo["textBlocked"] => {
    const block = runningModuleSettings("block");
    // block 모듈 checkText처럼 .write_div의 글자(writeText)로 검사한다. 본문 HTML을 풀면 디시 스크립트 글자가 섞이고
    // '<b>광</b>고'처럼 태그로 쪼갠 글이 빠져나간다.
    return block && postInfo.writeText !== undefined && isBlocked("TEXT", postInfo.writeText, preData.gallery) ? blockMode(block) : undefined;
};

/** 받은 지 1분 안의 캐시 본문과 그 나이(ms). 댓글 보존·추천이 항목을 다시 저장해 수명을 늘리므로 받은 시각으로 본다. */
const cachedPost = (preData: GalleryPreData): { post: PostInfo; age: number } | undefined => {
    const entry = getEntry(preData);
    const age = Date.now() - (entry?.fetchedAt ?? 0);
    return entry?.post && age < 60_000 ? {post: entry.post, age} : undefined;
};

/**
 * 이 시간(ms) 안에 받은 댓글은 글을 다시 열어도 다시 받지 않는다 (#273).
 * 댓글은 쪽마다 요청이라, 열고 닫기·PageUp/Down으로 같은 글을 오갈 때마다 받으면 몇 초 만에 요청이 수십 개 몰려 임시 차단된다.
 * 새로고침 버튼·자동 새로고침은 이와 상관없이 받는다.
 */
const COMMENTS_REUSE = 10_000;

const recentComments = (preData: GalleryPreData): CommentListResponse | undefined => {
    const entry = getEntry(preData);
    return entry?.comments && Date.now() - (entry.commentsAt ?? 0) < COMMENTS_REUSE ? entry.comments : undefined;
};

// 차단 모듈 설정에서 가공 결과가 읽는 값만 뽑은 비교 키 (아래 구독). 모듈이 꺼져 있으면 빈 문자열이다.
const blockKeyOf = (block: ModuleSettings["block"] | undefined): string => (block ? JSON.stringify([block.blur, block.replyRemove, duplicateOf(block)]) : "");

/** 새 댓글 강조 시간 (ms). assets/styles/tailwind.css의 fresh-comment 애니메이션 길이와 같다. */
const FRESH_DURATION = 3000;

const controller = (ctx: Ctx) => {
    const store = usePreviewStore;
    const ui = useUiStore.getState();

    let abort: AbortController | null = null;
    let savedHistory: SavedHistory | null = null;
    let refreshTimer = 0;
    let confirmPress = createDoublePress(1000);
    // 우클릭 누름·미니·열기·미리 받기가 같이 쓰는 본문 요청 하나. 다른 글을 받으면 앞 요청을 끊어 연타해도 쌓이지 않는다.
    let pending: { key: string; ctrl: AbortController; post: Promise<PostInfo> } | null = null;

    // 받은 글 객체마다 정화한 본문. 같은 글을 다시 열거나 미니로 볼 때 큰 본문을 다시 정화하지 않는다.
    // 글이 바뀌면(추천 등) 캐시에 새 객체가 들어가 다시 정화된다.
    const sanitized = new WeakMap<PostInfo, string>();
    const sanitizedStripped = new WeakMap<PostInfo, string>();
    const processContents = async (preData: GalleryPreData, postInfo: PostInfo, stripMedia = false): Promise<PostInfo> => {
        const cache = stripMedia ? sanitizedStripped : sanitized;
        let contents = cache.get(postInfo);
        if (contents === undefined) {
            // 정적 import다 — 파이어폭스는 콘텐츠 스크립트의 늦은 동적 import(청크)를 페이지를 다시 읽은 뒤에 못 읽는다.
            contents = sanitizeHtml(postInfo.contents ?? "", {stripMedia});
            cache.set(postInfo, contents);
        }
        return {...postInfo, contents, textBlocked: textBlockOf(preData, postInfo)};
    };

    const requestPost = (preData: GalleryPreData): Promise<PostInfo> => {
        const key = postKey(preData);
        if (pending?.key === key) return pending.post;

        pending?.ctrl.abort();
        const ctrl = new AbortController();
        const post = fetchPost(preData, ctrl.signal).then((result) => {
            setEntry(preData, {post: result, fetchedAt: Date.now()});
            return result;
        });
        const slot = {key, ctrl, post};
        pending = slot;

        // catch는 아무도 기다리지 않는 미리 받기가 실패해도 unhandled rejection이 나지 않게 붙인다.
        void post.catch(() => undefined).finally(() => {
            if (pending === slot) pending = null;
        });

        return post;
    };


    /**
     * 캐시에 있으면 캐시, 없으면 받는다. fresh는 방금 받은 본문인지다 (캐시 것은 1분까지 낡았을 수 있다).
     * archived: 받지 못해 보존해 둔 본문을 대신 줬다.
     */
    const getPost = async (preData: GalleryPreData): Promise<{ post: PostInfo; fresh: boolean; archived?: true }> => {
        const cached = !ctx.settings.disableCache ? cachedPost(preData) : undefined;
        // 우클릭을 누르는 동안 미리 받은 본문은 캐시에서 꺼내도 방금 받은 것으로 친다. 기준 2초는 길게 누르기 판정 시간의 상한이다.
        if (cached) return {post: cached.post, fresh: cached.age < 2000};

        try {
            return {post: await requestPost(preData), fresh: true};
        } catch (e) {
            // 다른 글로 넘어가 끊은 요청은 보존본으로 대신하지 않는다.
            if (isAbortError(e)) throw e;
            // 삭제된 글 보존: 받지 못하면 캐시 비활성화여도 캐시에 남은 이전 본문을 보여 준다. 다시 저장해 수명을 늘린다.
            const archived = ctx.settings.archiveArticle ? getEntry(preData)?.post : undefined;
            if (!archived) throw e;
            console.error("Preview fetch failed, showing the archived post:", e);
            setEntry(preData, {post: archived});
            return {post: archived, fresh: false, archived: true};
        }
    };

    const mini = createMini(ctx, getPost, processContents);

    // 보낸 순번과 그린 순번. 먼저 보낸 요청이 늦게 도착해 새 응답을 덮으면
    // 방금 쓴 댓글이 사라지거나 삭제된 것으로 보인다.
    let commentSeq = 0;
    let shownSeq = 0;
    // 받는 중인 댓글 요청 수. 응답이 느릴 때 자동 갱신이 요청을 겹쳐 보내지 않게 한다.
    let pulling = 0;
    // 마지막으로 그린 댓글 원본 (보존 처리까지 마친 것). 차단 목록·방식이 바뀌면 다시 받지 않고 이것으로 다시 가린다.
    // raw는 source를 만든 받은 목록이다. 같은 목록을 다시 받으면 다시 그리지 않는다.
    let shown: { signal: number; source: DcinsideComment[]; raw: DcinsideComment[] } | null = null;
    // 갤러리마다 마지막으로 받은 댓글 허용(멤버만 댓글이면 false). 댓글 0개 글은 댓글을 받지 않아 이 값을 쓴다.
    // 없으면 스토어 기본값(true) 때문에 멤버만 댓글 갤러리에서도 입력칸이 보인다.
    const allowReplies = new Map<string, boolean>();
    let freshTimer = 0;
    ctx.addCleanup(() => window.clearTimeout(freshTimer));

    /**
     * 댓글을 지금 차단 설정·글댓비로 가공한다. processComments는 처음 쓸 때 불러온 것을 받는다.
     * 새로 가공한 댓글 중 지금 그린 것과 같은 댓글은 그린 객체를 그대로 쓴다. 자동 새로고침으로 하나만 늘어도 전부 새 객체면 댓글 전부를 다시 그린다.
     * 음성 댓글은 voice가 매번 새 객체라 다시 그린다.
     */
    const processKeepingUnchanged = (process: typeof processComments, source: DcinsideComment[], preData: GalleryPreData): ProcessedComment[] => {
        const before = new Map(store.getState().comments?.map((comment) => [comment.no, comment]));
        return process(source, preData, runningModuleSettings("block"), useUiStore.getState().ratios).map((comment) => {
            const old = before.get(comment.no);
            return old && shallow(old, comment) ? old : comment;
        });
    };

    // 답글 대상 댓글이 목록에서 빠졌거나 삭제됐으면 답글 쓰기를 푼다. 두면 취소 버튼도 없이 없는 댓글에 답글을 단다.
    const dropStaleReply = (): void => {
        const {reply, comments} = store.getState();
        if (reply.replyNo && !comments?.some((comment) => comment.no === reply.replyNo && comment.is_delete !== "1")) {
            store.setState({reply: NO_REPLY});
        }
    };

    /**
     * 댓글을 받아 가공해 그린다. skip이면 받지 않고 빈 목록으로 처리한다 (보존해 둔 댓글은 삭제된 것으로 나온다).
     * given(미리 받은 목록·캐시의 지난 목록)이 있으면 그것을 그리고, 미리 받기가 비었거나 실패하면 다시 받는다.
     * 미리 받기도 여기서 기다려야 순번·pulling이 지금 잡혀, 늦게 온 옛 목록이 그사이 새로고침한 목록을 덮지 않는다.
     * cached: given이 캐시의 지난 목록이라 받은 시각을 갱신하지 않는다.
     */
    const pullComments = async (
        preData: GalleryPreData, post: PostInfo, mySignal: number, skip = false,
        given?: CommentListResponse | Promise<CommentListResponse | undefined>, cached = false
    ): Promise<void> => {
        // 부른 때의 요청을 쓴다. 미리 받기를 기다리는 사이 다른 글로 넘어가면 이미 끊겨 앞 글의 댓글을 다시 받지 않는다.
        const signal = abort?.signal ?? AbortSignal.abort();
        const seq = ++commentSeq;
        pulling++;

        try {
            // 댓글 가공(정화·차단)은 파일 위에서 정적으로 들어 와 있다. 파이어폭스는 콘텐츠 스크립트의 늦은
            // 동적 import(청크)를 페이지를 다시 읽은 직후에 못 읽는다.
            // 건너뛸 때는 이 갤러리에서 받아 둔 댓글 허용(멤버만 댓글)을 쓴다. 건너뛰는 쪽이 아는 갤러리만 건너뛴다.
            const {list: raw, allowReply, truncated} = skip
                ? {list: [], allowReply: allowReplies.get(preData.gallery) ?? store.getState().allowReply, truncated: false}
                : await Promise.resolve(given).then((list) => list ?? fetchComments(preData, post, signal));
            if (store.getState().signalId !== mySignal || seq < shownSeq) return;
            shownSeq = seq;
            if (!skip) {
                setEntry(preData, {comments: {list: raw, allowReply, truncated}, ...(cached ? {} : {commentsAt: Date.now()})});
                allowReplies.set(preData.gallery, allowReply);
            }

            // 보존 기록은 받을 때마다 갱신해야 하므로 prepareComments는 같은 목록이어도 부른다.
            const source = prepareComments(raw, preData, ctx.settings.archiveArticle, truncated);
            // 자동 새로고침으로 같은 목록을 다시 받았으면 정화·다시 그리기를 건너뛴다. 댓글이 수백 개면 정화만 수십 ms다.
            if (!skip && shown?.signal === mySignal && sameComments(raw, shown.raw)) {
                if (store.getState().allowReply !== allowReply) store.setState({allowReply});
                return;
            }
            // 같은 글의 목록을 다시 받았으면 새로 들어온 댓글을 표시한다. 글을 처음 열 때는 표시하지 않는다.
            const before = shown?.signal === mySignal && ctx.settings.highlightNewComments ? new Set(shown.source.map((comment) => comment.no)) : null;
            const added = before ? source.filter((comment) => !before.has(comment.no) && comment.is_delete !== "1").map((comment) => comment.no) : [];
            shown = {signal: mySignal, source, raw};
            store.setState({comments: processKeepingUnchanged(processComments, source, preData), allowReply, freshComments: added.length > 0 ? new Set(added) : NO_FRESH});
            // 강조(3초)가 끝나면 지운다. 남겨 두면 답글을 접었다 펴는 등 다시 그릴 때마다 강조가 되풀이된다.
            window.clearTimeout(freshTimer);
            if (added.length > 0) {
                freshTimer = window.setTimeout(() => {
                    if (store.getState().signalId === mySignal) store.setState({freshComments: NO_FRESH});
                }, FRESH_DURATION);
            }
            dropStaleReply();
        } finally {
            pulling--;
        }
    };

    // 열린 창에도 차단 목록·방식 변경을 바로 반영한다. 버블에서 차단하면 그 사람 댓글이 곧바로 가려진다.
    // 글댓비는 사용자마다 하나씩 도착해 각각 재가공을 일으키므로(200명이면 200번) 100ms 창마다 한 번으로 묶는다.
    // 첫 요청에서 타이머를 걸고 늦추지 않으므로(throttle) 도착이 길게 이어져도 창마다 한 번씩 반영된다.
    const reapplyBlocks = async (): Promise<void> => {
        const {visible, preData, signalId} = store.getState();
        if (!visible || !preData) return;

        // 댓글 재가공(정화·차단)은 파일 위에서 정적으로 들어 와 있다.
        // signalId가 바뀐 갈래는 s를 그대로 돌려 알림을 일으키지 않는다 (zustand는 Object.is로 거른다). {}를 돌려도
        // 새 상태로 쳐 댓글 수천 개의 selector가 죄다 다시 평가된다.
        store.setState((s) => (s.signalId !== signalId ? s : {
            post: s.post && {...s.post, textBlocked: textBlockOf(preData, s.post)},
            comments: shown?.signal === signalId ? processKeepingUnchanged(processComments, shown.source, preData) : s.comments
        }));
        dropStaleReply();
    };

    let reapplyTimer = 0;
    const scheduleReapplyBlocks = (): void => {
        if (reapplyTimer) return;
        reapplyTimer = window.setTimeout(() => {
            reapplyTimer = 0;
            void reapplyBlocks();
        }, 100);
    };
    ctx.addCleanup(() => window.clearTimeout(reapplyTimer));

    ctx.addCleanup(useBlocksStore.subscribe((state, previous) => {
        if (state.entries !== previous.entries || state.defaults !== previous.defaults) scheduleReapplyBlocks();
    }));
    // 차단 모듈의 켜짐·설정 중 가공 결과(processComments·textBlockOf)가 읽는 값만 본다. '가린 내용 보기'(blockRevealed·blurReveal)는 창과 댓글 목록이
    // 직접 구독하므로, 켜고 끌 때마다 댓글 수백 개를 다시 가공해 모두 다시 그리지 않는다. 모듈 설정은 하나만 바뀌어도 새 객체라 값으로 비교한다.
    let blockKey = blockKeyOf(runningModuleSettings("block"));
    const onBlockChange = (): void => {
        const key = blockKeyOf(runningModuleSettings("block"));
        if (key === blockKey) return;
        blockKey = key;
        scheduleReapplyBlocks();
    };
    ctx.addCleanup(moduleSettingsStore.subscribe(onBlockChange));
    ctx.addCleanup(runningModulesStore.subscribe(onBlockChange));
    // 깡계 가림(userinfo의 글댓비·깡계 설정)이 바뀌면 다시 가공한다. 글댓비는 새 글마다 받으므로, 열린 글 댓글의 깡계 판정이 달라질 때만 한다.
    ctx.addCleanup(useUiStore.subscribe(({ratios}, previous) => {
        if (ratios === previous.ratios || !shown) return;
        if (shown.source.some((comment) => lowActivityOf(ratios, comment.user_id) !== lowActivityOf(previous.ratios, comment.user_id))) scheduleReapplyBlocks();
    }));

    /**
     * 받지 못했으면 false (자동 새로고침이 주기를 늘린다). 받을 글이 없거나 끊은 요청은 실패로 치지 않는다.
     * report: 사용자가 누른 새로고침이면 실패를 알린다. 자동 갱신 실패는 조용히 넘긴다.
     */
    const refreshComments = async (report = false): Promise<boolean> => {
        const st = store.getState();
        if (!st.visible || !st.preData || !st.post || !abort) return true;

        // 받지 못했던 댓글을 다시 받는 동안은 안내 대신 받는 중 표시를 보인다.
        if (st.commentsFailed) store.setState({commentsFailed: false});
        try {
            await pullComments(st.preData, st.post, st.signalId);
            return true;
        } catch (e) {
            if (isAbortError(e)) return true;
            if (store.getState().signalId === st.signalId) store.setState({commentsFailed: true});
            // 임시 차단은 HTTP 클라이언트가 이미 알렸다. 덮어쓰지 않는다.
            if (!isBlockedError(e)) {
                console.error("Comment refresh failed:", e);
                if (report) ui.showToast("댓글을 불러오지 못했습니다.", "error");
            }
            return false;
        }
    };

    /**
     * 창 머리의 새로고침. 본문을 캐시 없이 다시 받고 댓글도 다시 받는다.
     * 같은 글이라 다시 마운트되지 않으므로 스크롤과 쓰던 댓글은 그대로다.
     */
    const reloadPost = async () => {
        const {visible, preData, signalId} = store.getState();
        if (!visible || !preData || !abort) return;

        try {
            const post = await processContents(preData, await requestPost(preData));
            if (store.getState().signalId !== signalId) return;
            store.setState({post, error: undefined, archived: false});
        } catch (e) {
            // 실패해도(삭제된 글 등) 보고 있던 본문은 그대로 둔다. 임시 차단은 HTTP 클라이언트가 이미 알렸다.
            if (isAbortError(e) || isBlockedError(e) || store.getState().signalId !== signalId) return;
            console.error("Preview reload failed:", e);
            ui.showToast("게시글을 다시 불러오지 못했습니다.", "error");
            return;
        }
        // 본문은 받았으니 댓글 실패는 댓글 실패로 알린다.
        await refreshComments(true);
    };

    const load = async (preData: GalleryPreData, mySignal: number, dir: number) => {
        let post: PostInfo;
        let fresh: boolean;
        let archived: boolean;

        // 본문을 받아야 하고 목록에 댓글이 보이는 글이면 댓글도 함께 요청한다. e_s_n_o는 갤러리마다 같아 이 페이지 값을 쓰고,
        // 본문의 값과 맞을 때만 결과를 쓴다. PageUp/Down·스크롤로 넘길 때는 지나가는 글마다 요청이 나가므로 하지 않는다.
        const esno = document.querySelector<HTMLInputElement>("#e_s_n_o")?.value;
        // 방금 받은 댓글(COMMENTS_REUSE)은 그대로 쓰고 다시 받지 않는다. 캐시를 끄면 늘 받는다.
        const recent = ctx.settings.disableCache ? undefined : recentComments(preData);
        const early = !dir && !recent && preData.commentCount > 0 && esno && (ctx.settings.disableCache || !cachedPost(preData))
            // 임시 차단으로 실패했으면 삼키지 않는다. 곧바로 같은 요청을 다시 보내면 차단만 길어진다.
            ? fetchComments(preData, {esno}, abort!.signal).catch((e: unknown) => {
                if (isBlockedError(e)) throw e;
                return undefined;
            })
            : undefined;
        // 본문을 받지 못해 given으로 쓰이지 않으면 처리되지 않은 거부가 된다.
        void early?.catch(() => undefined);

        try {
            ({post, fresh, archived = false} = await getPost(preData));
            post = await processContents(preData, post);
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
            // 본문을 방금 받았어도(fresh) 방금 받은 댓글은 쓴다. 그 밖에 캐시로 연 글은 받는 동안 지난번 댓글을 먼저 보인다.
            // 새로 받은 목록이 같으면 다시 그리지 않는다 (shown.raw).
            const last = recent ?? (fresh ? undefined : getEntry(preData)?.comments);
            // 캐시의 댓글은 본문과 한 번에 그려져, 댓글이 많으면 다 그릴 때까지 본문도 보이지 않는다. 본문을 한 프레임 먼저 그린다.
            if (last) await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve)));
            if (last) await pullComments(preData, post, mySignal, false, last, true);
            if (!recent) {
                // 미리 받은 댓글은 같은 요청이었을 때만 쓴다. 비어 있으면 다시 받는다.
                const matches = post.esno === esno && (post.commentId ?? preData.gallery) === preData.gallery && (post.commentNo ?? preData.id) === preData.id;
                const given = early?.then((list) => (matches && list?.list.length ? list : undefined));
                // 방금 받은 본문이 댓글 0개면 받지 않는다. 보존해 둔 댓글이 있으면 삭제 여부를 비교해야 하므로 받는다.
                // 이 갤러리의 댓글 허용을 아직 모르면 받는다 (멤버만 댓글이면 입력칸 대신 안내를 보여야 한다).
                const skip = fresh && post.commentCount === 0 && !Object.keys(getEntry(preData)?.seen ?? {}).length && allowReplies.has(preData.gallery);
                await pullComments(preData, post, mySignal, skip, given);
            }
        } catch (e) {
            // 댓글만 못 받았으면 본문은 그대로 두고 댓글 칸에 '다시 시도' 안내를 보인다. 임시 차단은 HTTP 클라이언트가 이미 알렸다.
            if (store.getState().signalId === mySignal && !isAbortError(e)) {
                store.setState({commentsFailed: true});
                if (!isBlockedError(e)) {
                    console.error("Comment load failed:", `${(e as {name?: string})?.name ?? ""}: ${(e as {message?: string})?.message ?? ""}`);
                    // 캐시의 지난 댓글을 보이고 있으면 안내가 뜨지 않으므로 토스트로 알린다.
                    if (store.getState().comments !== undefined) ui.showToast("댓글을 불러오지 못했습니다.", "error");
                }
            }
        }

        // PageUp/Down·스크롤로 넘겼으면 같은 방향 다음 글의 본문을 미리 받는다. 댓글은 열 때 받는다.
        // 받는 중인 요청(새로고침 버튼·미니 등)이 있으면 미리 받지 않는다. 미리 받으면 그 요청이 끊긴다.
        if (dir && !ctx.settings.disableCache && store.getState().signalId === mySignal) {
            const next = adjacentPreData(preData, dir);
            if (next && !pending && !cachedPost(next)) void requestPost(next);
        }
    };


    const restoreHistory = (fromHistory: boolean) => {
        if (savedHistory) {
            // 뒤로 가기로 닫았으면 주소는 이미 돌아가 있다.
            // 미리보기가 쌓은 만큼 뒤로 간다. 새로 쌓으면 열고 닫을 때마다 두 칸씩 늘어 갤러리 전의 기록이 밀려난다.
            // 쌓은 기록이 아닌데 주소가 바뀌어 있으면(창을 연 채 설정을 바꾼 경우 등) 원래 주소를 쌓는다.
            // 기록 조작은 장식이라 삼킨다. 던지면 close가 중간에 끊겨 창이 닫히지도 않고 Esc도 먹지 않는다.
            const depth = ownPreviewDepth();
            try {
                if (!fromHistory && depth > 0) history.go(-depth);
                else if (!fromHistory && location.href !== savedHistory.url) history.pushState(savedHistory.state, savedHistory.title, savedHistory.url);
            } catch (e) {
                console.error("미리보기 기록 되돌리기 실패:", e);
            }
            // popstate는 제목을 되돌리지 않는다.
            document.title = savedHistory.title;
        }

        savedHistory = null;
    };

    const close = (fromHistory = false) => {
        abort?.abort();
        abort = null;
        pending?.ctrl.abort();
        pending = null;

        window.clearTimeout(refreshTimer);
        // 지난 글의 댓글 원본(수백 개면 수백 KB)을 다음 글을 열 때까지 들고 있지 않는다. 다음 글은 새 signalId라 어차피 다시 그린다.
        shown = null;

        restoreHistory(fromHistory);
        store.getState().close();
    };

    // 사용자가 창을 닫으면 창이 열린 동안 건너뛴 목록 새로고침을 곧바로 한다.
    // 삭제·차단 뒤에 닫을 때는 refresh의 reload가 어차피 다시 받으므로 close를 그대로 부른다 (같이 부르면 목록을 두 번 받는다).
    const dismiss = (fromHistory = false) => {
        close(fromHistory);
        getModuleApi("refresh")?.catchUp();
    };

    /** dir: PageUp/Down·스크롤로 넘긴 방향. 그 방향 다음 글을 미리 받는다. */
    const open = (preData: GalleryPreData, commentsOnly = false, historySkip = false, dir = 0) => {
        // 대기·요청 중인 미니가 전체 미리보기 위에 뜨지 않게 한다.
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
        if (!historySkip && !st.visible) savedHistory = {title: document.title, url: location.href, state: history.state};
        // 글 주소를 기록에 쌓으면 브라우저가 방문한 글로 쳐 목록 링크가 :visited 색이 된다 (미리보기로 읽은 글 표시).
        if (ctx.settings.colorPreviewLink) {
            const newTitle = `${preData.title ?? document.title} - ${galName()}`;
            // 돌아갈 위치(back)도 같이 넣는다. 없으면 뒤로 가기로 다시 연 미리보기는 닫아도 글 주소에 남는다.
            // depth: 미리보기를 열기 전 기록에서 몇 칸 위인지. 닫을 때 그만큼 뒤로 간다.
            // 브라우저는 기록을 50개까지만 두고 오래된 것부터 지운다. 목록 항목까지 지워지면 닫아도 목록으로 못 돌아가므로 40칸부터는 쌓지 않고 바꾼다.
            if (!historySkip) {
                const depth = (st.visible ? ownPreviewDepth() : 0) + 1;
                const state: PreviewEntry = {refresher: 1, doc: historyDoc, preData, back: savedHistory ?? undefined, depth: Math.min(depth, 40)};
                // 기록 쌓기가 실패해도(브라우저의 횟수 제한 등) 창은 연다. 여기서 끊기면 새로고침 타이머와 본문 요청이
                // 아예 안 돌아 창이 멈춘 것처럼 보인다. 실패하면 :visited 색칠만 안 될 뿐이다.
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

        // 설정이 꺼져 있어도 타이머는 돌려, 열린 사이 바꾼 설정(켜고 끄기·간격)을 다음 차례부터 따른다.
        // 실패(임시 차단 등)가 이어지면 목록 새로고침처럼 주기를 두 배씩 늘린다 (최대 1분). 같은 주기로 보내면 차단이 길어진다.
        // 다음 타이머는 요청이 끝난 뒤, 같은 글이 열려 있을 때만 잡는다.
        let failures = 0;
        const scheduleRefresh = (): void => {
            const interval = ctx.settings.commentRefreshInterval;
            refreshTimer = window.setTimeout(async () => {
                if (ctx.settings.autoRefreshComment && !document.hidden && !pulling) failures = (await refreshComments()) ? 0 : failures + 1;
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
        // 응답 전에 다른 글로 넘어갔으면 공지·개념글 표시는 바꾸지 않고 알림만 띄운다.
        const stillOpen = (): boolean => store.getState().signalId === st.signalId;
        managing = true;

        // 바뀐 공지·개념글 상태를 글 정보와 지금 기록에 넣는다. 다른 글로 넘어갔다 뒤로 가기로 돌아오면
        // 기록에 남은 옛 상태로 버튼이 반대로 보여, 두 번 누르면 반대 요청이 나간다.
        const toggled = (field: "notice" | "recommend", value: boolean): void => {
            const preData = {...target, [field]: value};
            store.setState({preData});
            const entry = ownPreviewEntry(history.state);
            // 알림은 이미 떴다. 기록 고치기가 던지면 manage 끝의 목록 새로 고침을 건너뛰므로 replaceEntry가 삼킨다.
            if (entry?.preData?.id === target.id) replaceEntry({...entry, preData});
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
                    void refreshComments();
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
            savedHistory = state.back ?? null;
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
            if (!ctx.settings.disableCache && !cachedPost(preData)) void requestPost(preData);
        },
        mini
    });

    window.addEventListener("keydown", onKey, {signal: ctx.signal});
    window.addEventListener("popstate", onPopState, {signal: ctx.signal});

    // 앞/뒤로 가기로 돌아왔는데 목록 문서가 bfcache에 없으면 브라우저는 미리보기가 쌓은 항목을 글 주소로 새로 불러온다(파이어폭스에서 잦다).
    // 목록 주소로 바꿔 다시 불러오고, 목록에서 그 글 미리보기를 연다. 새로고침(F5)은 글 페이지 그대로 둔다.
    // 다시 연 항목은 새로 쌓지 않고 이 문서 것으로 바꾼다. 쌓으면 목록 항목이 둘이 되어 뒤로 가기를 두 번 눌러야 한다.
    // 기록 고치기가 실패해도(브라우저의 횟수 제한 등) setup은 끝낸다. 던지면 미리보기 모듈이 이 페이지에서 통째로 실패한다.
    const replaceEntry = (state: unknown, url?: string): boolean => {
        try {
            history.replaceState(state, "", url);
            return true;
        } catch (e) {
            console.error("미리보기 기록 고치기 실패:", e);
            return false;
        }
    };
    const entry = previewEntry(history.state);
    if (entry && entry.doc !== historyDoc && entry.preData && entry.back) {
        const {preData, back} = entry;
        const navigation = performance.getEntriesByType("navigation")[0];
        if (entry.reopen) {
            replaceEntry({...entry, doc: historyDoc, reopen: false}, preData.link);
            savedHistory = back;
            whenDomReady(() => open(preData, false, true), ctx.signal);
        } else if (navigation instanceof PerformanceNavigationTiming && navigation.type === "back_forward" && document.readyState !== "complete") {
            // 문서를 불러오는 중일 때만 옮긴다. 미리보기를 끈 채 연 글 페이지에서 나중에 켜면(팝업·옵션·bfcache 동기화) setup이 다시 도는데,
            // 탐색 종류는 그대로 back_forward라 읽던 글이 목록으로 바뀌고 쓰던 댓글이 날아간다.
            // 주소를 못 바꿨으면 다시 불러와도 글 페이지 그대로라 새로고침하지 않는다.
            if (replaceEntry({...entry, reopen: true}, back.url)) location.reload();
        } else if (navigation instanceof PerformanceNavigationTiming && (navigation.type === "reload" || navigation.type === "back_forward")) {
            // 새로고침했거나 다 불러온 뒤에 미리보기를 켠 글 페이지는 이제 진짜 글 항목이다. 미리보기 표시를 지운다.
            // 남겨 두면 목록으로 뒤로 갔다 앞으로 올 때 bfcache가 없으면 위 back_forward로 다시 목록·미리보기가 된다.
            replaceEntry(null);
        }
    }

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
            await refreshComments(report);
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
