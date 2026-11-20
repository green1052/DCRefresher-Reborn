import {shallow} from "zustand/vanilla/shallow";

import {duplicateOf} from "@/core/block";
import {runningModuleSettings, moduleSettingsStore, runningModulesStore} from "@/core/module/registry";
import {prepareComments, processComments, sameComments} from "@/core/preview/comments";
import {setEntry} from "@/core/preview/cache";
import {fetchComments} from "@/core/preview/request";
import type {CommentListResponse, DcinsideComment, GalleryPreData, PostInfo} from "@/core/preview/types";
import {useBlocksStore} from "@/stores/blocks";
import {lowActivityOf, useUiStore} from "@/stores/ui";
import {isAbortError} from "@/utils/error";
import type {ModuleSettings} from "@/core/module/types";
import type {ProcessedComment} from "@/core/preview/comments";

import {textBlockOf} from "./postLoader";
import type {Ctx} from "./meta";
import {NO_FRESH, NO_REPLY, usePreviewStore} from "./ui/previewStore";

/** 새 댓글 강조 시간 (ms). assets/styles/tailwind.css의 fresh-comment 애니메이션 길이와 같다. */
const FRESH_DURATION = 3000;

// 차단 모듈 설정에서 가공 결과가 읽는 값만 뽑은 비교 키 (아래 구독). 모듈이 꺼져 있으면 빈 문자열이다.
const blockKeyOf = (block: ModuleSettings["block"] | undefined): string => (block ? JSON.stringify([block.blur, block.replyRemove, duplicateOf(block)]) : "");

/** 댓글을 받아 가공해 그리는 파이프라인 - 순번 가드, 차단 재적용, 자동 새로고침까지. signal은 창의 현재 요청 신호를 돌려준다. */
export const createCommentsPull = (ctx: Ctx, signal: () => AbortSignal | undefined) => {
    const store = usePreviewStore;
    const ui = useUiStore.getState();

    // 보낸 순번과 그린 순번 - 늦게 도착한 옛 응답이 새 목록을 덮지 않게 한다.
    let commentSeq = 0;
    let shownSeq = 0;
    // 받는 중인 댓글 요청 수. 응답이 느릴 때 자동 갱신이 요청을 겹쳐 보내지 않게 한다.
    let pulling = 0;
    // 마지막으로 그린 댓글 원본 - 차단이 바뀌면 다시 받지 않고 이것으로 다시 가린다(raw는 같은 목록이면 다시 그리지 않는다).
    let shown: { signal: number; source: DcinsideComment[]; raw: DcinsideComment[] } | null = null;
    // 갤러리마다 받은 댓글 허용 - 기본값(true)이면 멤버만 댓글 갤러리에서도 입력칸이 보인다.
    const allowReplies = new Map<string, boolean>();
    let freshTimer = 0;
    ctx.addCleanup(() => window.clearTimeout(freshTimer));

    // 늦게 도착한 갈래가 그린 뒤의 목록을 덮지 않게 한다.
    const stale = (mySignal: number, seq: number): boolean => store.getState().signalId !== mySignal || seq < shownSeq;

    /** 지금 설정으로 가공하되 그린 것과 같은 댓글은 그 객체를 그대로 써 전부 다시 그리지 않는다. */
    const processKeepingUnchanged = async (process: typeof processComments, source: DcinsideComment[], preData: GalleryPreData): Promise<ProcessedComment[]> => {
        const before = new Map(store.getState().comments?.map((comment) => [comment.no, comment]));
        const processed = await process(source, preData, runningModuleSettings("block"), useUiStore.getState().ratios);
        return processed.map((comment) => {
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

    /** 댓글을 받아 가공해 그린다. skip이면 빈 목록으로, given이 있으면 그것을 그린다(여기서 기다려 순번이 덮지 않게 한다). */
    const pullComments = async (
        preData: GalleryPreData, post: PostInfo, mySignal: number, skip = false,
        given?: CommentListResponse | Promise<CommentListResponse | undefined>, cached = false
    ): Promise<void> => {
        // 부른 때의 요청을 쓴다. 미리 받기를 기다리는 사이 다른 글로 넘어가면 이미 끊겨 앞 글의 댓글을 다시 받지 않는다.
        const requestSignal = signal() ?? AbortSignal.abort();
        const seq = ++commentSeq;
        pulling++;

        try {
            const [{list: raw, allowReply, truncated}] = await Promise.all([
                skip ? {list: [], allowReply: allowReplies.get(preData.gallery) ?? store.getState().allowReply, truncated: false} : await Promise.resolve(given).then((list) => list ?? fetchComments(preData, post, requestSignal))
            ]);
            if (stale(mySignal, seq)) return;
            shownSeq = seq;
            if (!skip) {
                setEntry(preData, {comments: {list: raw, allowReply, truncated}, ...(cached ? {} : {commentsAt: Date.now()})});
                allowReplies.set(preData.gallery, allowReply);
            }

            // 보존 기록은 받을 때마다 갱신해야 하므로 prepareComments는 같은 목록이어도 부른다.
            const source = prepareComments(raw, preData, ctx.settings.archiveArticle, truncated);
            // 자동 새로고침으로 같은 목록을 다시 받았으면 정화, 다시 그리기를 건너뛴다. 댓글이 수백 개면 정화만 수십 ms다.
            if (!skip && shown?.signal === mySignal && sameComments(raw, shown.raw)) {
                if (store.getState().allowReply !== allowReply) store.setState({allowReply});
                return;
            }
            // 같은 글의 목록을 다시 받았으면 새로 들어온 댓글을 표시한다. 글을 처음 열 때는 표시하지 않는다.
            const before = shown?.signal === mySignal && ctx.settings.highlightNewComments ? new Set(shown.source.map((comment) => comment.no)) : null;
            const added = before ? source.filter((comment) => !before.has(comment.no) && comment.is_delete !== "1").map((comment) => comment.no) : [];
            shown = {signal: mySignal, source, raw};
            const comments = await processKeepingUnchanged(processComments, source, preData);
            // 정화를 기다리는 사이 다른 댓글 받기가 끝났으면 옛 목록으로 덮지 않는다.
            if (stale(mySignal, seq)) return;
            store.setState({comments, allowReply, freshComments: added.length > 0 ? new Set(added) : NO_FRESH});
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

    // 차단 목록, 방식 변경을 열린 창에 바로 반영한다 - 글댓비는 100ms 창마다 한 번으로 묶는다(throttle).
    const reapplyBlocks = async (): Promise<void> => {
        const {visible, preData, signalId} = store.getState();
        if (!visible || !preData) return;

        const source = shown?.signal === signalId ? shown.source : undefined;
        const seq = commentSeq;
        const comments = source ? await processKeepingUnchanged(processComments, source, preData) : undefined;
        // 기다리는 사이 댓글을 다시 받았으면 옛 목록으로 덮지 않는다.
        if (comments && (seq !== commentSeq || store.getState().signalId !== signalId)) return;

        // signalId가 바뀐 갈래는 s를 그대로 돌린다 - {}는 새 상태로 쳐 selector가 죄다 다시 평가된다.
        store.setState((s) => (s.signalId !== signalId ? s : {
            post: s.post && {...s.post, textBlocked: textBlockOf(preData, s.post)},
            comments: comments ?? s.comments
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
    // 가공 결과가 읽는 값만 본다 - '가린 내용 보기'는 창이 직접 구독해 댓글 전부를 다시 가공하지 않는다.
    let blockKey = blockKeyOf(runningModuleSettings("block"));
    const onBlockChange = (): void => {
        const key = blockKeyOf(runningModuleSettings("block"));
        if (key === blockKey) return;
        blockKey = key;
        scheduleReapplyBlocks();
    };
    ctx.addCleanup(moduleSettingsStore.subscribe(onBlockChange));
    ctx.addCleanup(runningModulesStore.subscribe(onBlockChange));
    // 깡계 가림(userinfo의 글댓비, 깡계 설정)이 바뀌면 다시 가공한다. 글댓비는 새 글마다 받으므로, 열린 글 댓글의 깡계 판정이 달라질 때만 한다.
    ctx.addCleanup(useUiStore.subscribe(({ratios}, previous) => {
        if (ratios === previous.ratios || !shown) return;
        if (shown.source.some((comment) => lowActivityOf(ratios, comment.user_id) !== lowActivityOf(previous.ratios, comment.user_id))) scheduleReapplyBlocks();
    }));

    /** 받지 못했으면 false(자동 새로고침이 주기를 늘린다). report면 실패를 알린다. */
    const refreshComments = async (report = false): Promise<boolean> => {
        const st = store.getState();
        const requestSignal = signal();
        if (!st.visible || !st.preData || !st.post || !requestSignal) return true;

        // 받지 못했던 댓글을 다시 받는 동안은 안내 대신 받는 중 표시를 보인다.
        if (st.commentsFailed) store.setState({commentsFailed: false});
        try {
            // 자동 새로고침은 1쪽만 보고 새 댓글이 없으면 나머지 쪽을 받지 않는다.
            if (!report && shown) {
                const newest = String(Math.max(0, ...shown.source.map((comment) => Number(comment.no) || 0)));
                const fresh = await fetchComments(st.preData, st.post, requestSignal, newest);
                if (fresh !== undefined) await pullComments(st.preData, st.post, st.signalId, false, fresh);
                return true;
            }
            await pullComments(st.preData, st.post, st.signalId);
            return true;
        } catch (e) {
            if (isAbortError(e)) return true;
            if (store.getState().signalId === st.signalId) store.setState({commentsFailed: true});
            console.error("Comment refresh failed:", e);
            if (report) ui.showToast("댓글을 불러오지 못했습니다.", "error");
            return false;
        }
    };

    return {
        pullComments,
        refreshComments,
        scheduleReapplyBlocks,
        isPulling: (): boolean => pulling > 0,
        forgetShown: (): void => {
            shown = null;
        },
        hasAllowReply: (gallery: string): boolean => allowReplies.has(gallery)
    };
};
