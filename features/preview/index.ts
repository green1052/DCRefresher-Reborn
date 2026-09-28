import {HTTPError} from "ky";
import {SquareMousePointer} from "lucide-react";

import {eventBus} from "@/core/eventbus/bus";
import {BLOCKED_TEXT, isBlocked} from "@/core/block";
import {BlockedError, isAbortError} from "@/core/http/client";
import {BOARD_PAGE} from "@/core/pages";
import {defineModule} from "@/core/module/define";
import type {DcinsideComment, GalleryPreData, PostInfo} from "@/core/preview/types";
import {useBlocksStore} from "@/stores/blocks";
import {useUiStore} from "@/stores/ui";
import {messageOf} from "@/utils/error";
import {isTyping, pressedKey} from "@/utils/event";
import {isGalleryManager} from "@/utils/user";
import {notifyManage} from "@/utils/notify";
import {isRecord} from "@/utils/record";

import {getEntry, setEntry} from "@/core/preview/cache";
import {ADULT_ERROR} from "@/core/preview/parser";
import {blockUser, bump, deletePost, fetchComments, fetchPost, setNotice, setRecommend} from "@/core/preview/request";
import {adjacentPreData, buildPreData, isBlurHidden, isTextPost} from "./rows";
import {type Ctx, settings} from "./settings";
import {type ErrorState, type ManageKind, miniPosition, NO_HOOKS, postTitle, usePreviewStore} from "./ui/previewStore";

// status는 ky의 HTTPError에서 읽는다 (삭제된 글은 404).
// 성인 인증 안내 페이지면 parsePostInfo가 Error(ADULT_ERROR)를 던진다.
const errorOf = (error: unknown): ErrorState => ({
    detail: messageOf(error),
    // 임시 차단(빈 페이지)은 200으로 오므로 요청 제한(429)으로 본다
    status: error instanceof HTTPError ? error.response.status : error instanceof BlockedError ? 429 : undefined,
    adult: error instanceof Error && error.message === ADULT_ERROR
});

const controller = (ctx: Ctx) => {
    const store = usePreviewStore;
    const ui = useUiStore.getState();

    let abort: AbortController | null = null;
    let savedHistory: { title: string; url: string; state: unknown } | null = null;
    // 히스토리 항목에 넣어 이 문서가 쌓은 것인지 가린다. 새로고침한 페이지에 남은 예전 항목으로는 미리보기를 열지 않는다.
    const historyDoc = performance.timeOrigin;
    let refreshTimer = 0;
    let pressStart = 0;
    let preventOpen = false;
    let lastKey = "";
    let lastKeyTime = 0;
    let miniTimer = 0;
    // 미니를 띄울 제목 칸. 본문을 받는 사이 커서가 떠났으면 띄우지 않는다.
    let miniTarget: HTMLElement | null = null;
    // 받는 중인 본문 요청 하나. 우클릭 누름·미니·열기·미리 받기가 같이 쓴다.
    // 다른 글을 받으면 앞 요청은 끊어, 연타해도 요청이 쌓이지 않는다.
    let pending: { key: string; ctrl: AbortController; post: Promise<PostInfo> } | null = null;

    // 제목 링크의 첫 텍스트 노드만 읽는다. h1(로고)엔 인라인 스크립트가, 링크 전체엔 마이너·미니 표시가 섞인다.
    const galName = (): string => document.querySelector(".page_head h2 a")?.firstChild?.textContent?.trim() || "디시인사이드";

    // 본문 차단은 차단 모듈 설정(blockView)을 따르고, 모듈이 꺼져 있으면 가리지 않는다.
    // 원문은 지우지 않아 '가린 내용 보기'로 다시 볼 수 있다 (Frame.tsx).
    const textBlockOf = (preData: GalleryPreData, postInfo: PostInfo): PostInfo["textBlocked"] => {
        const view = useUiStore.getState().blockView;
        // block 모듈 checkText처럼 .write_div의 글자(writeText)로 검사한다. 본문 HTML을 풀어 쓰면 디시 스크립트 글자가 섞이고,
        // 태그 자리가 공백이 돼 '<b>광</b>고' 같은 글이 빠져나간다.
        return view && postInfo.writeText !== undefined && isBlocked("TEXT", postInfo.writeText, preData.gallery) ? (view.blur ? "blur" : "hide") : undefined;
    };

    const processContents = async (preData: GalleryPreData, postInfo: PostInfo, stripMedia = false): Promise<PostInfo> => {
        // 정화기는 처음 쓸 때 불러온다. 미리보기를 안 여는 페이지에서까지 DOMPurify를 만들지 않는다.
        const {sanitizeHtml} = await import("@/utils/sanitize");
        return {...postInfo, contents: sanitizeHtml(postInfo.contents ?? "", {stripMedia}), textBlocked: textBlockOf(preData, postInfo)};
    };

    const requestPost = (preData: GalleryPreData): Promise<PostInfo> => {
        const key = `${preData.gallery}/${preData.id}`;
        if (pending?.key === key) return pending.post;

        pending?.ctrl.abort();
        const ctrl = new AbortController();
        const post = fetchPost(preData, ctrl.signal).then((result) => {
            setEntry(preData, {post: result, fetchedAt: Date.now()});
            return result;
        });
        const slot = {key, ctrl, post};
        pending = slot;

        // 끝나면 칸을 비운다 (받은 본문은 캐시에 있다). catch는 아무도 기다리지 않는 미리 받기가 실패해도
        // unhandled rejection이 나지 않게 붙인다.
        void post.catch(() => undefined).finally(() => {
            if (pending === slot) pending = null;
        });

        return post;
    };

    /** 받은 지 1분 안의 캐시 본문과 그 나이(ms). 댓글 보존·추천이 항목을 다시 저장해 수명을 늘리므로 받은 시각으로 본다 */
    const cachedPost = (preData: GalleryPreData): { post: PostInfo; age: number } | undefined => {
        const entry = getEntry(preData);
        const age = Date.now() - (entry?.fetchedAt ?? 0);
        return entry?.post && age < 60_000 ? {post: entry.post, age} : undefined;
    };

    /**
     * 캐시에 있으면 캐시, 없으면 받는다. fresh는 방금 받은 본문인지다 (캐시 것은 1분까지 낡았을 수 있다).
     * archived는 받지 못해 보존해 둔 본문을 대신 준 것이다
     */
    const getPost = async (preData: GalleryPreData): Promise<{ post: PostInfo; fresh: boolean; archived?: true }> => {
        const cached = !ctx.settings.disableCache ? cachedPost(preData) : undefined;
        // 우클릭을 누르는 동안 미리 받은 본문은 캐시에서 꺼내도 방금 받은 것으로 친다. 기준 2초는 길게 누르기 판정 시간의 상한이다.
        if (cached) return {post: cached.post, fresh: cached.age < 2000};

        try {
            return {post: await requestPost(preData), fresh: true};
        } catch (e) {
            // 다른 글로 넘어가 끊은 요청은 보존본으로 대신하지 않는다.
            // 파이어폭스에선 다른 realm의 DOMException이라 instanceof가 안 맞아 이름으로 본다.
            if (isAbortError(e)) throw e;
            // 삭제된 글 보존: 받지 못하면 캐시 비활성화여도 캐시에 남은 이전 본문을 보여 준다. 다시 저장해 수명을 늘린다.
            const archived = ctx.settings.archiveArticle ? getEntry(preData)?.post : undefined;
            if (!archived) throw e;
            console.error("Preview fetch failed, showing the archived post:", e);
            setEntry(preData, {post: archived});
            return {post: archived, fresh: false, archived: true};
        }
    };

    // 보낸 순번과 그린 순번. 먼저 보낸 요청이 늦게 도착해 새 응답을 덮으면
    // 방금 쓴 댓글이 사라지거나 삭제된 것으로 보인다.
    let commentSeq = 0;
    let shownSeq = 0;
    // 받는 중인 댓글 요청 수. 응답이 느릴 때 자동 갱신이 요청을 겹쳐 보내지 않게 한다.
    let pulling = 0;
    // 마지막으로 그린 댓글 원본 (보존 처리까지 마친 것). 차단 목록·방식이 바뀌면 다시 받지 않고 이것으로 다시 가린다.
    let shown: { signal: number; source: DcinsideComment[] } | null = null;
    /** shown을 만든 받은 목록(JSON). 같은 목록을 다시 받으면 다시 그리지 않는다 */
    let shownRaw = "";

    // 답글 대상 댓글이 목록에서 빠졌거나 삭제됐으면 답글 쓰기를 푼다. 두면 취소 버튼도 없이 없는 댓글에 답글을 단다
    const dropStaleReply = (): void => {
        const {reply, comments} = store.getState();
        if (reply.replyNo && !comments?.some((comment) => comment.no === reply.replyNo && comment.is_delete !== "1")) {
            store.setState({reply: {commentNo: null, replyNo: null}});
        }
    };

    /** 댓글을 받아 가공해 그린다. skip이면 받지 않고 빈 목록으로 처리한다 (보존해 둔 댓글은 삭제된 것으로 나온다) */
    const pullComments = async (preData: GalleryPreData, post: PostInfo, mySignal: number, skip = false): Promise<void> => {
        const seq = ++commentSeq;
        pulling++;

        try {
            // 댓글 가공(정화·차단)도 처음 쓸 때 불러온다.
            const [{prepareComments, processComments}, {list: raw, allowReply}] = await Promise.all([
                import("@/core/preview/comments"),
                // 건너뛸 때는 지금 알고 있는 댓글 허용(멤버만 댓글)을 그대로 둔다
                skip ? {list: [], allowReply: store.getState().allowReply} : fetchComments(preData, post, abort!.signal)
            ]);
            if (store.getState().signalId !== mySignal || seq < shownSeq) return;
            shownSeq = seq;

            // 보존(archive) 기록은 받을 때마다 갱신해야 하므로 정리는 늘 한다
            const source = prepareComments(raw, preData, ctx.settings.archiveArticle);
            // 자동 새로고침으로 같은 목록을 다시 받았으면 정화·다시 그리기를 건너뛴다. 댓글이 수백 개면 정화만 수십 ms다
            const rawKey = JSON.stringify(raw);
            if (!skip && shown?.signal === mySignal && rawKey === shownRaw) {
                if (store.getState().allowReply !== allowReply) store.setState({allowReply});
                return;
            }
            shownRaw = rawKey;
            shown = {signal: mySignal, source};
            store.setState({comments: processComments(source, preData), allowReply});
            dropStaleReply();
        } finally {
            pulling--;
        }
    };

    // 열린 창에도 차단 목록·방식 변경을 바로 반영한다. 버블에서 차단하면 그 사람 댓글이 곧바로 가려진다.
    const reapplyBlocks = async (): Promise<void> => {
        const {visible, preData, signalId} = store.getState();
        if (!visible || !preData) return;

        const {processComments} = await import("@/core/preview/comments");
        store.setState((s) => (s.signalId !== signalId ? {} : {
            post: s.post && {...s.post, textBlocked: textBlockOf(preData, s.post)},
            comments: shown?.signal === signalId ? processComments(shown.source, preData) : s.comments
        }));
        dropStaleReply();
    };

    ctx.addCleanup(useBlocksStore.subscribe((state, previous) => {
        if (state.entries !== previous.entries || state.defaults !== previous.defaults) void reapplyBlocks();
    }));
    ctx.addCleanup(useUiStore.subscribe((state, previous) => {
        if (state.blockView !== previous.blockView) void reapplyBlocks();
    }));

    /** report: 사용자가 누른 새로고침이면 실패를 알린다. 자동 갱신 실패는 조용히 넘긴다 */
    const refreshComments = async (report = false) => {
        const st = store.getState();
        if (!st.visible || !st.preData || !st.post || !abort) return;

        try {
            await pullComments(st.preData, st.post, st.signalId);
        } catch (e) {
            // 임시 차단은 HTTP 클라이언트가 이미 알렸다. 덮어쓰지 않는다
            if (report && !isAbortError(e) && !(e instanceof BlockedError)) ui.showToast("댓글을 불러오지 못했습니다.", "error");
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
            await pullComments(preData, post, signalId);
        } catch (e) {
            // 실패해도(삭제된 글 등) 보고 있던 본문은 그대로 둔다.
            if (isAbortError(e) || store.getState().signalId !== signalId) return;
            ui.showToast("게시글을 다시 불러오지 못했습니다.", "error");
        }
    };

    const load = async (preData: GalleryPreData, mySignal: number, dir: number) => {
        let post: PostInfo;
        let fresh: boolean;
        let archived: boolean;

        try {
            ({post, fresh, archived = false} = await getPost(preData));
            post = await processContents(preData, post);
        } catch (e) {
            if (store.getState().signalId !== mySignal) return;
            // 화면에는 ErrorBlock의 안내만 보이므로 원문은 콘솔에 남긴다
            console.error("Preview load failed:", e);
            store.setState({error: errorOf(e)});
            return;
        }

        if (store.getState().signalId !== mySignal) return;
        store.setState({post, archived});

        try {
            // 방금 받은 본문이 댓글 0개면 받지 않는다. 보존해 둔 댓글이 있으면 삭제 여부를 비교해야 하므로 받는다.
            await pullComments(preData, post, mySignal, fresh && post.commentCount === 0 && !Object.keys(getEntry(preData)?.seen ?? {}).length);
        } catch (e) {
            // 댓글만 못 받았으면 본문은 그대로 두고 알린다. 임시 차단은 HTTP 클라이언트가 이미 알렸다
            if (store.getState().signalId === mySignal && !(e instanceof BlockedError)) ui.showToast("댓글을 불러오지 못했습니다.", "error");
        }

        // PageUp/Down으로 넘겼으면 같은 방향 다음 글의 본문을 미리 받는다. 댓글은 열 때 받는다.
        // 받는 중인 요청(새로고침 버튼·미니 등)이 있으면 미리 받지 않는다. 받으면 그 요청을 끊는다.
        if (dir && !ctx.settings.disableCache && store.getState().signalId === mySignal) {
            const next = adjacentPreData(preData, dir);
            if (next && !pending && !cachedPost(next)) void requestPost(next);
        }
    };

    /** 지금 기록이 이 문서의 미리보기가 쌓은 것이면, 미리보기를 열기 전 기록에서 몇 칸 위인지 (아니면 0) */
    const historyDepth = (): number => {
        const state: unknown = history.state;
        return isRecord(state) && state.refresher === 1 && state.doc === historyDoc && typeof state.depth === "number" ? state.depth : 0;
    };

    const restoreHistory = (fromHistory: boolean) => {
        if (savedHistory) {
            // 뒤로 가기로 닫았으면 주소는 이미 돌아가 있다.
            // 미리보기가 쌓은 만큼 뒤로 간다. 새로 쌓으면 열고 닫을 때마다 두 칸씩 늘어 갤러리 전의 기록이 밀려난다.
            // 쌓은 기록이 아닌데 주소가 바뀌어 있으면(창을 연 채 설정을 바꾼 경우 등) 원래 주소를 쌓는다
            const depth = historyDepth();
            if (!fromHistory && depth > 0) history.go(-depth);
            else if (!fromHistory && location.href !== savedHistory.url) history.pushState(savedHistory.state, savedHistory.title, savedHistory.url);
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

        if (refreshTimer) window.clearInterval(refreshTimer);
        refreshTimer = 0;

        restoreHistory(fromHistory);
        store.getState().close();
    };

    /** dir: PageUp/Down으로 넘긴 방향. 그 방향 다음 글을 미리 받는다 */
    const open = (preData: GalleryPreData, commentsOnly = false, historySkip = false, dir = 0) => {
        // 대기·요청 중인 미니가 전체 미리보기 위에 뜨지 않게 한다.
        onMiniLeave();

        const st = store.getState();

        if (st.visible && st.preData?.id === preData.id && st.preData?.gallery === preData.gallery) {
            if (!st.error) {
                store.setState({commentsOnly});
                return;
            }
            // 오류 난 글을 다시 열면('다시 시도') 제자리에서 다시 받는다. 닫았다 열면 히스토리가 두 칸 쌓인다.
            historySkip = true;
        }

        abort?.abort();
        abort = new AbortController();
        if (refreshTimer) window.clearInterval(refreshTimer);
        refreshTimer = 0;
        // 두 번 누르기는 글마다 새로 센다. 이전 글에서 한 번 누른 키로 다음 글이 바로 지워지면 안 된다.
        lastKey = "";

        store.getState().open(preData, {
            commentsOnly,
            // 목록에 이미지 아이콘이 없는 글만 본문 이미지를 숨긴다.
            imageBlocked: ctx.settings.blockImage && isTextPost(preData),
            notice: preData.notice,
            recommend: preData.recommend,
            adminVisible: ctx.settings.toggleAdminPanel && isGalleryManager()
        });

        const mySignal = store.getState().signalId;

        // 이미 열린 창에서 다음 글로 넘어갈 때는 처음 저장한 위치를 유지한다. 덮어쓰면 닫을 때 미리보기 주소로 되돌아간다.
        if (!historySkip && !st.visible) savedHistory = {title: document.title, url: location.href, state: history.state};
        if (ctx.settings.colorPreviewLink) {
            const newTitle = `${preData.title ?? document.title} - ${galName()}`;
            // 돌아갈 위치(back)도 같이 넣는다. 없으면 뒤로 가기로 다시 연 미리보기는 닫아도 글 주소에 남는다.
            // depth: 미리보기를 열기 전 기록에서 몇 칸 위인지. 닫을 때 그만큼 뒤로 간다.
            // 브라우저는 기록을 50개까지만 두고 오래된 것부터 지운다. 목록 항목까지 지워지면 닫아도 목록으로 못 돌아가므로 40칸부터는 쌓지 않고 바꾼다
            if (!historySkip) {
                const depth = (st.visible ? historyDepth() : 0) + 1;
                const state = {refresher: 1, doc: historyDoc, preData, back: savedHistory, depth: Math.min(depth, 40)};
                if (depth > 40) history.replaceState(state, newTitle, preData.link);
                else history.pushState(state, newTitle, preData.link);
            }
            // 히스토리로 다시 열 때도 바꾼다. popstate는 제목을 되돌리지 않는다.
            document.title = newTitle;
        }

        // 설정이 꺼져 있어도 타이머는 둔다. 열린 사이 설정을 켜고 끄면 다음 차례부터 따른다
        refreshTimer = window.setInterval(() => {
            if (!ctx.settings.autoRefreshComment || document.hidden || pulling) return;
            void refreshComments();
        }, ctx.settings.commentRefreshInterval || 10000);

        void load(preData, mySignal, dir);
    };

    // 관리 요청은 한 번에 하나만 보낸다. 패널을 연타해도 같은 POST가 두 번 가지 않는다.
    let managing = false;

    const manage = async (kind: ManageKind) => {
        const st = store.getState();
        if (!st.preData || !st.post || managing) return;

        const target = st.preData;
        // 응답 전에 다른 글로 넘어갔으면 공지·개념글 표시는 바꾸지 않고 알림만 띄운다.
        const stillOpen = (): boolean => store.getState().signalId === st.signalId;
        managing = true;

        // 바뀐 공지·개념글 상태를 글 정보와 지금 기록에도 넣는다. 다른 글로 넘어갔다 뒤로 가기로 돌아오면
        // 기록에 남은 옛 상태로 버튼이 반대로 보여, 두 번 누르면 반대 요청이 나간다
        const toggled = (field: "notice" | "recommend", value: boolean): void => {
            const preData = {...target, [field]: value};
            store.setState(field === "notice" ? {notice: value, preData} : {recommend: value, preData});
            const state: unknown = history.state;
            if (isRecord(state) && isRecord(state.preData) && state.preData.id === target.id) history.replaceState({...state, preData}, "");
        };

        const failure = "처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
        try {
            // 공지·개념글 표시는 성공했을 때만 바꾼다.
            if (kind === "notice") {
                if (await notifyManage(setNotice(target, !st.notice), st.notice ? "공지를 해제했습니다." : "공지로 등록했습니다.", failure) && stillOpen()) {
                    toggled("notice", !st.notice);
                }
            } else if (kind === "recommend") {
                if (await notifyManage(setRecommend(target, !st.recommend), st.recommend ? "개념글을 해제했습니다." : "개념글로 등록했습니다.", failure) && stillOpen()) {
                    toggled("recommend", !st.recommend);
                }
            } else if (kind === "delete") {
                close();
                await notifyManage(deletePost(target), "게시글을 삭제했습니다.", failure);
            } else if (kind === "bump") {
                await notifyManage(bump(target), "게시글을 끌올했습니다.", failure);
            }
        } finally {
            managing = false;
        }

        eventBus.emit("refreshRequest");
    };

    const blockPreset = async (target: GalleryPreData) => {
        const signal = store.getState().signalId;
        const blocked = await notifyManage(blockUser(target, {
            avoidHour: ctx.settings.blockPresetDay,
            avoidReason: "0",
            avoidReasonTxt: ctx.settings.blockPresetReason,
            delChk: ctx.settings.blockPresetDelete,
            userTypeChk: ctx.settings.blockPresetUserType
        }), "차단했습니다.", "차단하지 못했습니다. 잠시 후 다시 시도해 주세요.");

        // 그새 다른 글로 넘어갔으면 창을 닫지 않는다.
        if (blocked && ctx.settings.blockPresetDelete && store.getState().signalId === signal) close();

        eventBus.emit("refreshRequest");
    };

    const onKey = (ev: KeyboardEvent) => {
        if (!ctx.settings.useKeyPress || !store.getState().visible) return;
        // Ctrl+D(북마크) 같은 조합키와 키를 누르고 있을 때의 반복 입력은 무시한다.
        if (ev.ctrlKey || ev.altKey || ev.metaKey || ev.repeat) return;

        // 설정값도 옵션 화면에서 같은 pressedKey로 받았으므로 그대로 비교한다.
        const key = pressedKey(ev);
        const isDelete = key === ctx.settings.deleteKey;
        if (!isDelete && key !== ctx.settings.blockKey) return;

        if (isTyping(ev) || !isGalleryManager()) return;

        const now = Date.now();

        if (lastKey === key && now - lastKeyTime < 1000) {
            lastKey = "";
            ev.preventDefault();
            void (isDelete ? manage("delete") : store.getState().preData && blockPreset(store.getState().preData!));
        } else {
            lastKey = key;
            lastKeyTime = now;
            ui.showToast(`한 번 더 ${key.toUpperCase()} 키를 누르면 ${isDelete ? "게시글을 삭제" : "작성자를 차단"}합니다.`);
        }
    };

    const onPopState = (ev: PopStateEvent) => {
        // 이 문서에서 쌓은 항목이면 창이 열려 있어도 그 글을 연다. PageDown으로 넘긴 뒤 뒤로 가면 이전 글이 열린다.
        const state = ev.state as { refresher?: number; doc?: number; preData?: GalleryPreData; back?: typeof savedHistory } | null;
        if (state?.refresher === 1 && state.doc === historyDoc && state.preData) {
            savedHistory = state.back ?? null;
            open(state.preData, false, true);
            return;
        }

        if (store.getState().visible) close(true);
    };

    // ── 미니 미리보기 ────────────────────────────────────────────
    const showMini = async (element: HTMLElement, x: number, y: number) => {
        const preData = buildPreData(element);
        if (!preData) return;

        let post: PostInfo;
        try {
            ({post} = await getPost(preData));
            post = await processContents(preData, post, ctx.settings.tooltipMediaHide);
        } catch {
            return;
        }

        // 받는 사이 행을 떠났거나 전체 미리보기가 열렸으면 띄우지 않는다.
        if (miniTarget !== element || usePreviewStore.getState().visible) return;

        usePreviewStore.setState({
            mini: {
                ...miniPosition(x, y),
                title: postTitle(post),
                // 미니에는 마우스를 올려 블러를 걷을 수 없으니 블러 차단도 안내 문구로 가린다.
                contents: post.textBlocked && !useUiStore.getState().blockView?.revealed ? BLOCKED_TEXT : post.contents ?? "",
                // 전체 미리보기와 같은 조건으로 이미지를 가린다. 다르면 거기서 숨긴 이미지가 호버로 보인다.
                blockMedia: ctx.settings.blockImage && isTextPost(preData),
                wheel: ctx.settings.tooltipWheel
            }
        });
    };

    const onMiniEnter = (ev: MouseEvent) => {
        if (!ctx.settings.tooltipMode) return;
        if (usePreviewStore.getState().visible) return;

        const element = ev.currentTarget as HTMLElement;
        if (isBlurHidden(element)) return;
        const x = ev.clientX;
        const y = ev.clientY;

        miniTarget = element;
        if (miniTimer) window.clearTimeout(miniTimer);
        miniTimer = 0;
        // 0이면 바로 띄운다. 목록을 가로지르면 행마다 요청이 나가지만, 다른 행으로 옮기면 앞 요청은 끊긴다.
        if (ctx.settings.tooltipDelay <= 0) void showMini(element, x, y);
        else miniTimer = window.setTimeout(() => void showMini(element, x, y), ctx.settings.tooltipDelay);
    };

    const onMiniMove = (ev: MouseEvent) => {
        usePreviewStore.getState().moveMini(ev.clientX, ev.clientY);
    };

    const onMiniLeave = () => {
        if (miniTimer) window.clearTimeout(miniTimer);
        miniTimer = 0;
        // 받는 중인 본문은 끊지 않는다. 클릭해 열면 같은 요청을 이어 쓰고, 다른 글을 받을 때 끊긴다.
        miniTarget = null;
        // 떠 있을 때만 비운다. 제목 칸을 지날 때마다 setState하면 스토어를 구독하는 창·댓글이 모두 다시 확인한다.
        if (usePreviewStore.getState().mini) usePreviewStore.setState({mini: null});
    };

    // ── 행 이벤트 ────────────────────────────────────────────────
    // 우클릭 길게 누르기: mousedown에서 시각을 기록하고, mouseup에서 판정해 contextmenu에서 쓴다.
    const onMouseDown = (ev: MouseEvent) => {
        if (ev.button !== 2) return;
        pressStart = Date.now();
        preventOpen = false;

        // 윈도우는 contextmenu가 버튼을 뗄 때 오므로, 누르고 있는 동안 본문을 미리 받는다.
        // Shift+우클릭(브라우저 메뉴)과 키 반전(우클릭은 글 이동)이면 열지 않으니 받지 않는다.
        if (ev.shiftKey) return;
        const resolved = resolveTarget(ev);
        if (!resolved || (!resolved.commentsOnly && ctx.settings.reversePreviewKey)) return;
        // 캐시를 끄면 열 때 캐시를 보지 않는다. 떼기 전에 다 받으면 한 번 더 받게 되므로 미리 받지 않는다.
        if (!ctx.settings.disableCache && !cachedPost(resolved.preData)) void requestPost(resolved.preData);
        // 오버레이도 처음 쓸 때 띄우므로(수십 ms) 떼기를 기다리는 동안 미리 띄운다.
        // 다음 task에서 한다. 여기서 띄우면 오버레이 모듈 초기화가 마이크로태스크로 먼저 돌아 본문 요청이 그만큼 늦게 나간다
        if (!usePreviewStore.getState().warm) window.setTimeout(() => usePreviewStore.setState({warm: true}));
    };

    const onMouseUp = (ev: MouseEvent) => {
        if (ev.button !== 2 || pressStart === 0) return;

        const delay = ctx.settings.longPressDelay || 300;
        if (Date.now() - delay > pressStart) preventOpen = true;
        pressStart = 0;
    };

    // 제목 칸(.ub-word) 안에서 난 이벤트는 제목 칸 핸들러가 이미 처리했다. 버블링으로 받은 행 핸들러는 건너뛴다.
    const handledByWord = (element: HTMLElement, target: HTMLElement): boolean =>
        element.classList.contains("ub-content") && target.closest(".ub-word") !== null;

    // 우클릭·좌클릭·미리 받기가 같은 기준으로 대상을 고르게 한 곳에서 판정한다.
    const resolveTarget = (ev: MouseEvent): { preData: GalleryPreData; commentsOnly: boolean } | null => {
        const element = ev.currentTarget as HTMLElement;
        const target = ev.target as HTMLElement;
        if (handledByWord(element, target)) return null;

        // 댓글 수 링크는 댓글만 보기로 연다. 행 전체 인식이 꺼져 있어도 열리게 아래 검사보다 먼저 본다.
        const commentsOnly = target.closest(".reply_numbox") !== null;

        if (!commentsOnly) {
            if (element.classList.contains("ub-content") && !ctx.settings.expandRecognizeRange) return null;

            // 작성자 칸 클릭은 유저 버블(차단·유저 정보 모듈) 몫이라 행 전체 인식이어도 열지 않는다.
            if (target.closest(".ub-writer")) return null;
        }

        const preData = buildPreData(element);
        return preData ? {preData, commentsOnly} : null;
    };

    const onContextMenu = (ev: MouseEvent) => {
        // Shift+우클릭은 브라우저 메뉴로 남긴다. 맥·리눅스는 누르는 순간 메뉴가 떠서 길게 누르기로는 열 수 없다.
        if (ev.shiftKey) return;

        const resolved = resolveTarget(ev);
        if (!resolved) return;

        // 길게 눌렀으면 댓글 수·키 반전이어도 기본 우클릭 메뉴다.
        if (preventOpen) {
            preventOpen = false;
            return;
        }

        if (resolved.commentsOnly) {
            ev.preventDefault();
            open(resolved.preData, true);
            return;
        }

        if (ctx.settings.reversePreviewKey) {
            ev.preventDefault();
            location.href = resolved.preData.link;
            return;
        }

        // 짧게 눌렀으면 미리보기다.
        ev.preventDefault();
        open(resolved.preData);
    };

    const onClick = (ev: MouseEvent) => {
        // 수정키 클릭(새 탭·창으로 열기, manage 모듈의 Ctrl+클릭 삭제)은 가로채지 않는다.
        if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey) return;

        const resolved = resolveTarget(ev);
        if (!resolved || (!resolved.commentsOnly && !ctx.settings.reversePreviewKey)) return;

        ev.preventDefault();
        open(resolved.preData, resolved.commentsOnly);
    };

    // 같은 함수는 addEventListener로 두 번 붙지 않아, 필터가 같은 요소로 다시 불러도 괜찮다.
    const bind = (element: HTMLElement, word: boolean) => {
        const options = {signal: ctx.signal};

        element.addEventListener("mousedown", onMouseDown, options);
        element.addEventListener("mouseup", onMouseUp, options);
        element.addEventListener("contextmenu", onContextMenu, options);
        element.addEventListener("click", onClick, options);

        if (word) {
            element.addEventListener("mouseenter", onMiniEnter, options);
            element.addEventListener("mousemove", onMiniMove, options);
            element.addEventListener("mouseleave", onMiniLeave, options);
        }
    };

    ctx.addFilter(
        ".gall_list .ub-word",
        (element) => bind(element, true)
    );

    ctx.addFilter(
        ".gall_list .ub-content",
        (element) => bind(element, false)
    );

    window.addEventListener("keydown", onKey, {signal: ctx.signal});
    window.addEventListener("popstate", onPopState, {signal: ctx.signal});

    ctx.addCleanup(() => {
        // 행 리스너(mouseleave)가 떨어지면 떠 있거나 받는 중인 미니를 닫을 길이 없어 여기서 닫는다.
        onMiniLeave();
        close();
        store.setState(NO_HOOKS);
    });

    store.setState({
        requestOpen: (preData, commentsOnly, dir) => open(preData, commentsOnly, false, dir),
        requestClose: () => close(),
        requestRefresh: (report) => refreshComments(report),
        requestReload: () => reloadPost(),
        requestManage: (kind) => void manage(kind)
    });
};

/** 창(Frame)이 그릴 때 읽는 설정을 스토어에 올린다. onChanged로도 불려 열린 창에 바로 반영된다 */
const publishSettings = (ctx: Ctx): void => {
    usePreviewStore.setState({
        shortcutKeys: ctx.settings.useKeyPress
            ? {delete: ctx.settings.deleteKey.toUpperCase(), block: ctx.settings.blockKey.toUpperCase()}
            : null,
        frameWidth: ctx.settings.previewWidth,
        backgroundBlur: ctx.settings.toggleBackgroundBlur,
        scrollToSkip: ctx.settings.scrollToSkip
    });
};

/** 다른 모듈이 쓰는 미리보기 api (getModuleApi("preview")) */
export interface PreviewApi {
    /** '삭제된 글과 댓글 보존' 설정. 새로고침 모듈도 목록에서 지워진 글을 남길지 이것으로 정한다 */
    archiveArticle(): boolean;

    /** 미리보기 창이 열려 있는지. 새로고침 모듈은 열려 있는 동안 자동 새로고침을 쉰다 */
    isOpen(): boolean;
}

declare module "@/core/module/types" {
    interface ModuleApis {
        preview: PreviewApi;
    }
}

export default defineModule({
    id: "preview",
    name: "미리보기",
    description: "글 목록에서 클릭 또는 우클릭으로 미리보기 창을 띄워 줍니다.",
    icon: SquareMousePointer,
    urls: [BOARD_PAGE],
    settings,
    setup: (ctx): PreviewApi => {
        publishSettings(ctx);
        controller(ctx);
        return {archiveArticle: () => ctx.settings.archiveArticle, isOpen: () => usePreviewStore.getState().visible};
    },
    onChanged: publishSettings
});
