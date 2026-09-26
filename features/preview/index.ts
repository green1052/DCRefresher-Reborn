import {HTTPError} from "ky";
import {SquareMousePointer} from "lucide-react";

import {eventBus} from "@/core/eventbus/bus";
import {isBlocked} from "@/core/block";
import {defineModule} from "@/core/module/define";
import type {ModuleContext, ModuleDefinition, SettingGroup} from "@/core/module/types";
import type {DcinsideComment, GalleryPreData, PostInfo} from "@/core/preview/types";
import {useBlocksStore} from "@/stores/blocks";
import {useUiStore} from "@/stores/ui";
import {isTyping, pressedKey} from "@/utils/event";
import {isGalleryManager} from "@/utils/user";
import {notifyManage} from "@/utils/notify";

import {getEntry, setEntry} from "@/core/preview/cache";
import {ADULT_ERROR} from "@/core/preview/parser";
import {blockUser, bump, deletePost, fetchComments, fetchPost, setNotice, setRecommend} from "@/core/preview/request";
import {BLOCK_DAYS, BLOCKED_TEXT, type ErrorState, type ManageKind, miniPosition, NO_HOOKS, postTitle, usePreviewStore} from "./ui/previewStore";

const SHORTCUT_GROUP: SettingGroup = {name: "관리 단축키", desc: "관리 권한이 있을 때 미리보기에서 키를 두 번 누르면 게시글을 삭제하거나 작성자를 차단합니다."};
const PRESET_GROUP: SettingGroup = {name: "차단 프리셋", desc: "차단 키로 차단할 때 쓰는 값입니다."};
const FRAME_GROUP: SettingGroup = {name: "미리보기 창", desc: "미리보기 창의 너비와 바깥 배경입니다."};

const settings: NonNullable<ModuleDefinition["settings"]> = {
    previewWidth: {
        type: "range",
        group: FRAME_GROUP,
        name: "창 너비",
        desc: "미리보기 창의 너비입니다. 브라우저 창이 좁으면 그에 맞춰 줄어듭니다.",
        default: 1000,
        min: 700,
        max: 1600,
        step: 50,
        unit: "px"
    },
    // v5와 같은 키 — 마이그레이션한 값을 그대로 쓴다
    toggleBackgroundBlur: {
        type: "check",
        group: FRAME_GROUP,
        name: "바깥 배경 흐리게",
        desc: "미리보기 창 바깥 배경을 흐리게 처리합니다. (성능이 떨어질 수 있음)",
        default: false
    },
    // v5와 같은 키
    scrollToSkip: {
        type: "check",
        name: "스크롤하여 게시글 이동",
        desc: "미리보기 맨 아래나 맨 위에서 한 번 더 스크롤하면 다음·이전 게시글로 넘어갑니다.",
        default: true
    },
    tooltipMode: {type: "check", name: "미니 미리보기 표시", desc: "게시글에 마우스를 올리면 미리보기를 표시합니다.", default: false},
    tooltipMediaHide: {type: "check", name: "미니 미리보기 미디어 숨기기", desc: "미니 미리보기에서 이미지와 동영상을 숨깁니다.", default: false},
    tooltipDelay: {
        type: "range",
        name: "미니 미리보기 딜레이",
        desc: "미니 미리보기가 표시되기까지의 지연 시간입니다.",
        default: 0,
        min: 0,
        max: 1000,
        step: 50,
        unit: "ms"
    },
    reversePreviewKey: {type: "check", name: "미리보기 키 반전", desc: "좌클릭으로 미리보기, 우클릭으로 게시글 이동을 사용합니다.", default: false},
    longPressDelay: {
        type: "range",
        name: "길게 누르기 판정 시간",
        desc: "마우스 오른쪽 버튼을 해당 시간 이상 눌렀다 뗄 때 기본 우클릭 메뉴가 나오게 합니다. (Windows 전용 — Shift+우클릭은 어디서나 기본 메뉴)",
        default: 300,
        min: 200,
        max: 2000,
        step: 50,
        unit: "ms"
    },
    colorPreviewLink: {type: "check", name: "게시글 URL 변경", desc: "미리보기로 본 게시글의 주소와 제목을 변경합니다.", default: true},
    autoRefreshComment: {type: "check", name: "댓글 자동 새로고침", desc: "일정 주기로 댓글을 자동으로 새로고침합니다.", default: false},
    commentRefreshInterval: {
        type: "range",
        name: "댓글 자동 새로고침 주기",
        desc: "댓글 자동 새로고침 주기입니다.",
        default: 10000,
        min: 3000,
        max: 20000,
        step: 100,
        unit: "ms"
    },
    toggleAdminPanel: {type: "check", name: "관리 패널 활성화", desc: "관리 권한이 있을 때 관리 패널을 표시합니다.", default: true},
    useKeyPress: {type: "check", group: SHORTCUT_GROUP, name: "사용", desc: "키로 게시글을 삭제·차단합니다.", default: true},
    deleteKey: {type: "key", group: SHORTCUT_GROUP, name: "삭제 키", desc: "두 번 누르면 게시글을 삭제합니다.", default: "d"},
    blockKey: {type: "key", group: SHORTCUT_GROUP, name: "차단 키", desc: "두 번 누르면 차단 프리셋으로 작성자를 차단합니다.", default: "b"},
    blockPresetDay: {type: "option", group: PRESET_GROUP, name: "차단 기간", desc: "차단 기간입니다.", default: "1", items: BLOCK_DAYS},
    blockPresetDelete: {type: "check", group: PRESET_GROUP, name: "글도 삭제", desc: "차단하면서 게시글도 삭제합니다.", default: false},
    blockPresetUserType: {type: "check", group: PRESET_GROUP, name: "IP 동시 차단", desc: "식별 코드와 함께 IP도 차단합니다.", default: false},
    blockPresetReason: {
        type: "text",
        group: PRESET_GROUP,
        name: "차단 사유",
        desc: "차단 사유입니다. (한글 20자 이내)",
        default: "",
        placeholder: "직접 입력 (한글 20자 이내)"
    },
    expandRecognizeRange: {type: "check", name: "게시글 인식 범위 확장", desc: "행 전체를 클릭해도 미리보기가 열리게 합니다.", default: false},
    disableCache: {type: "check", name: "캐시 비활성화", desc: "미리보기 캐시를 사용하지 않습니다.", default: false},
    archiveArticle: {type: "check", name: "삭제된 글과 댓글 보존", desc: "캐시된 게시글이 삭제되어도 이전 내용을 보여줍니다.", default: false},
    blockImage: {
        type: "check",
        name: "이미지 아이콘 없는 게시글 이미지 차단",
        desc: "이미지 아이콘이 없는 게시글에 이미지가 있으면 차단합니다.",
        default: false
    }
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

    // 목록 아이콘 클래스에서 게시글 타입 추출 (이미지 아이콘 없는 글 판별)
    const icon = row.querySelector<HTMLElement>(".icon_img");
    let type = "icon_txt";
    let notice = false;
    let recommend = false;

    if (icon) {
        const classes = icon.getAttribute("class") ?? "";
        type = classes.split(" ").at(-1) ?? "icon_txt";
        notice = classes.includes("icon_notice");
        // 이미지·텍스트·동영상 개념글 (icon_recomimg, icon_recomtxt, icon_recomovie)
        recommend = classes.includes("icon_recom");
    }

    return {
        gallery: gallery ?? "",
        id: id ?? "",
        title: anchor.textContent?.trim() || undefined,
        link: url.href,
        notice,
        recommend,
        type
    };
};

/** 차단 모듈이 블러로 가린 행 — 보이긴 하지만('가린 내용 보기' 중이 아니면) 넘기기·미니로 내용을 열지 않는다 */
const isBlurHidden = (element: Element): boolean =>
    !document.documentElement.classList.contains("refresherBlockReveal") && element.closest(".refresherBlur") !== null;

/** 목록에서 앞(-1)/뒤(1) 글 — 차단·운영자 숨김·블러 행은 건너뛴다 (미리보기는 TEXT 차단만 검사해서 숨긴 글이 그대로 열린다) */
export const adjacentPreData = (from: GalleryPreData, dir: number): GalleryPreData | null => {
    const rows = Array.from(document.querySelectorAll<HTMLElement>(".gall_list .ub-content")).filter((row) =>
        row.checkVisibility() && row.querySelector("a:not(.reply_numbox)")
    );

    const index = rows.findIndex((row) => {
        const pre = buildPreData(row);
        return pre?.id === from.id && pre?.gallery === from.gallery;
    });
    if (index < 0) return null;

    // 블러 행은 찾은 뒤에 거른다 — 지금 글이 블러 행이어도 제자리를 찾게
    const ahead = dir > 0 ? rows.slice(index + 1) : rows.slice(0, index).reverse();
    const next = ahead.find((row) => !isBlurHidden(row));
    return next ? buildPreData(next) : null;
};

/** 목록에 이미지 아이콘이 없는 글 (텍스트 개념글 포함) — blockImage가 본문 이미지를 가린다 */
const isTextPost = (preData: GalleryPreData): boolean => preData.type === "icon_txt" || preData.type === "icon_recomtxt";

// 상태 코드: ky가 던지는 HTTPError, 또는 fetchPost가 본문을 못 찾아 던지는 Error("404") — 성인 인증 안내면 parsePostInfo가 Error(ADULT_ERROR)
const errorOf = (error: unknown): ErrorState => ({
    detail: error instanceof Error ? error.message : String(error),
    status: error instanceof HTTPError ? error.response.status : error instanceof Error && error.message === "404" ? 404 : undefined,
    adult: error instanceof Error && error.message === ADULT_ERROR
});

const controller = (ctx: ModuleContext) => {
    const store = usePreviewStore;
    const ui = useUiStore.getState();

    let abort: AbortController | null = null;
    let savedHistory: { title: string; url: string; state: unknown } | null = null;
    // 이 문서에서 쌓은 히스토리인지 — 새로고침한 글 페이지에 남은 예전 상태로 미리보기를 다시 열지 않게
    const historyDoc = performance.timeOrigin;
    let refreshTimer = 0;
    let pressStart = 0;
    let preventOpen = false;
    let lastKey = "";
    let lastKeyTime = 0;
    let miniTimer = 0;
    // 미니를 띄울 제목 칸 — 받는 사이 떠났으면 띄우지 않는다
    let miniTarget: HTMLElement | null = null;
    // 받는 중인 본문 한 칸 — 우클릭 누름·미니·열기·미리 받기가 같이 쓴다. 다른 글을 받으면 앞의 것은 끊는다 (연타해도 쌓이지 않게)
    let pending: { key: string; ctrl: AbortController; post: Promise<PostInfo> } | null = null;

    // 갤러리 이름은 제목 링크의 첫 글자 칸 — h1(로고)엔 인라인 스크립트가, 링크엔 마이너·미니 표시가 섞인다
    const galName = (): string => document.querySelector(".page_head h2 a")?.firstChild?.textContent?.trim() || "디시인사이드";

    // 본문 차단도 차단 모듈을 따른다 — 꺼져 있으면 가리지 않는다. 원문은 남겨 '가린 내용 보기'로 다시 보인다 (Frame.tsx)
    const textBlockOf = (preData: GalleryPreData, postInfo: PostInfo): PostInfo["textBlocked"] => {
        const view = useUiStore.getState().blockView;
        // 페이지와 같은 글자로 본다 (block 모듈 checkText) — 본문 칸째 풀면 디시 스크립트·템플릿 글자가 섞이고 태그 자리가 공백이 돼 '<b>광</b>고'로 비켜 간다
        const writeDiv = postInfo.dom.querySelector(".write_div");
        return view && writeDiv && isBlocked("TEXT", writeDiv.textContent?.trim() ?? "", preData.gallery) ? (view.blur ? "blur" : "hide") : undefined;
    };

    const processContents = async (preData: GalleryPreData, postInfo: PostInfo, stripMedia = false): Promise<PostInfo> => {
        // 정화기는 처음 쓸 때 불러온다 — 모든 페이지에서 DOMPurify를 만들지 않게
        const {sanitizeHtml} = await import("@/utils/sanitize");
        return {...postInfo, contents: sanitizeHtml(postInfo.contents ?? "", {stripMedia}), textBlocked: textBlockOf(preData, postInfo)};
    };

    // 받은 시각 — 우클릭을 누르는 동안 미리 받은 본문은 캐시에서 나와도 방금 받은 것으로 친다 (길게 누르기 판정 상한 2초)
    const fetchedAt = new WeakMap<PostInfo, number>();

    const requestPost = (preData: GalleryPreData): Promise<PostInfo> => {
        const key = `${preData.gallery}/${preData.id}`;
        if (pending?.key === key) return pending.post;

        pending?.ctrl.abort();
        const ctrl = new AbortController();
        const post = fetchPost(preData, ctrl.signal).then((result) => {
            fetchedAt.set(result, Date.now());
            setEntry(preData, {post: result});
            return result;
        });
        const slot = {key, ctrl, post};
        pending = slot;

        // 받은 본문은 캐시에 있으니 끝나면 비운다 — 아무도 기다리지 않는 미리 받기가 실패해도 처리 안 된 거부로 남지 않게 catch
        void post.catch(() => undefined).finally(() => {
            if (pending === slot) pending = null;
        });

        return post;
    };

    /** 캐시에 있으면 캐시, 없으면 받는다. fresh: 방금 받은 본문 — 캐시 것은 1분까지 낡았을 수 있다 */
    const getPost = async (preData: GalleryPreData): Promise<{ post: PostInfo; fresh: boolean }> => {
        const cached = ctx.settings.disableCache !== true ? getEntry(preData)?.post : undefined;
        if (cached) return {post: cached, fresh: Date.now() - (fetchedAt.get(cached) ?? 0) < 2000};

        try {
            return {post: await requestPost(preData), fresh: true};
        } catch (e) {
            // 다른 글로 넘어가 끊은 요청은 실패가 아니다 (파이어폭스는 다른 realm의 DOMException이라 이름으로 본다)
            if ((e as Error | undefined)?.name === "AbortError") throw e;
            // 삭제된 글 보존: 가져오지 못하면 캐시에 남은 이전 본문을 보여준다 (캐시 비활성화여도). 다시 저장해 수명을 늘린다
            const archived = ctx.settings.archiveArticle === true ? getEntry(preData)?.post : undefined;
            if (!archived) throw e;
            setEntry(preData, {post: archived});
            return {post: archived, fresh: false};
        }
    };

    // 보낸 순번·그린 순번 — 먼저 보낸 요청의 응답이 늦게 와서 새 응답을 덮지 않게 (방금 쓴 댓글이 사라지거나 삭제로 보인다)
    let commentSeq = 0;
    let shownSeq = 0;
    // 받는 중인 댓글 요청 수 — 자동 갱신이 느린 응답 위로 겹쳐 쌓이지 않게
    let pulling = 0;
    // 마지막으로 그린 댓글(아카이브까지 마친 것) — 차단 목록·방식이 바뀌면 받지 않고 이것으로 다시 가린다
    let shown: { signal: number; source: DcinsideComment[] } | null = null;

    /** 댓글을 받아 가공해 그린다. skip이면 받지 않고 빈 목록으로 (보존한 댓글은 되살아난다) */
    const pullComments = async (preData: GalleryPreData, post: PostInfo, mySignal: number, skip = false): Promise<void> => {
        const seq = ++commentSeq;
        pulling++;

        try {
            // 가공(정화·차단)도 처음 쓸 때 불러온다
            const [{prepareComments, processComments}, {list: raw, allowReply}] = await Promise.all([
                import("@/core/preview/comments"),
                skip ? {list: [], allowReply: true} : fetchComments(preData, post, abort!.signal)
            ]);
            if (store.getState().signalId !== mySignal || seq < shownSeq) return;
            shownSeq = seq;

            const source = prepareComments(raw, preData, ctx);
            shown = {signal: mySignal, source};
            store.setState({comments: processComments(source, preData), allowReply});
        } finally {
            pulling--;
        }
    };

    // 열린 창도 차단 목록·방식을 따른다 — 버블에서 차단하면 그 사람 댓글이 바로 가려지게
    const reapplyBlocks = async (): Promise<void> => {
        const {visible, preData, signalId} = store.getState();
        if (!visible || !preData) return;

        const {processComments} = await import("@/core/preview/comments");
        store.setState((s) => (s.signalId !== signalId ? {} : {
            post: s.post && {...s.post, textBlocked: textBlockOf(preData, s.post)},
            comments: shown?.signal === signalId ? processComments(shown.source, preData) : s.comments
        }));
    };

    ctx.addCleanup(useBlocksStore.subscribe((state, previous) => {
        if (state.entries !== previous.entries || state.defaults !== previous.defaults) void reapplyBlocks();
    }));
    ctx.addCleanup(useUiStore.subscribe((state, previous) => {
        if (state.blockView !== previous.blockView) void reapplyBlocks();
    }));

    const refreshComments = async () => {
        const st = store.getState();
        if (!st.visible || !st.preData || !st.post || !abort) return;

        try {
            await pullComments(st.preData, st.post, st.signalId);
        } catch {
            // 자동 갱신 실패는 조용히 무시
        }
    };

    const load = async (preData: GalleryPreData, mySignal: number, dir: number) => {
        let post: PostInfo;
        let fresh: boolean;

        try {
            ({post, fresh} = await getPost(preData));
            post = await processContents(preData, post);
        } catch (e) {
            if (store.getState().signalId === mySignal) store.setState({error: errorOf(e)});
            return;
        }

        if (store.getState().signalId !== mySignal) return;
        store.setState({post});

        try {
            // 방금 받은 본문이 댓글 0개면 받지 않는다 — 보존해 둔 댓글이 있으면 받아서 비교한다
            await pullComments(preData, post, mySignal, fresh && post.commentCount === 0 && !Object.keys(getEntry(preData)?.seen ?? {}).length);
        } catch {
            // 댓글만 못 받았으면 본문은 그대로 두고 알린다
            if (store.getState().signalId === mySignal) ui.showToast("댓글을 불러오지 못했습니다.", "error");
        }

        // PageUp/Down으로 넘겼으면 그쪽 다음 글 본문도 미리 받는다 — 댓글은 열 때 받는다
        if (dir && ctx.settings.disableCache !== true && store.getState().signalId === mySignal) {
            const next = adjacentPreData(preData, dir);
            if (next && !getEntry(next)?.post) void requestPost(next);
        }
    };

    const restoreHistory = (fromHistory: boolean) => {
        if (savedHistory) {
            // 주소를 바꿨을 때만 되돌린다 — 설정으로 보면 연 채로 설정을 바꿀 때 어긋난다. 뒤로 가기로 닫았으면 주소는 이미 돌아갔다
            if (!fromHistory && location.href !== savedHistory.url) history.pushState(savedHistory.state, savedHistory.title, savedHistory.url);
            // popstate는 제목을 되돌리지 않는다
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

    /** dir: PageUp/Down으로 넘긴 방향 (그쪽 다음 글을 미리 받는다) */
    const open = (preData: GalleryPreData, commentsOnly = false, historySkip = false, dir = 0) => {
        // 호버 대기·요청 중인 미니가 전체 미리보기 위에 뜨지 않게
        onMiniLeave();

        const st = store.getState();

        if (st.visible && st.preData?.id === preData.id && st.preData?.gallery === preData.gallery) {
            if (!st.error) {
                store.setState({commentsOnly});
                return;
            }
            // 오류 난 글을 다시 열면(다시 시도) 제자리에서 다시 받는다 — 닫았다 열면 히스토리가 두 칸 쌓인다
            historySkip = true;
        }

        abort?.abort();
        abort = new AbortController();
        if (refreshTimer) window.clearInterval(refreshTimer);
        refreshTimer = 0;
        // 두 번 누르기 확인은 글마다 — 이전 글에서 한 번 누른 키로 다음 글이 바로 지워지지 않게
        lastKey = "";

        store.getState().open(preData, {
            commentsOnly,
            // 목록에 이미지 아이콘이 없는(텍스트) 글만 본문 이미지 숨김
            imageBlocked: ctx.settings.blockImage === true && isTextPost(preData),
            notice: preData.notice,
            recommend: preData.recommend,
            adminVisible: ctx.settings.toggleAdminPanel === true && isGalleryManager()
        });

        const mySignal = store.getState().signalId;

        // 미리보기가 이미 열려 있으면(다음 글 전환) 최초 히스토리 유지 — 아니면 close가 가짜 URL을 복원함
        if (!historySkip && !st.visible) savedHistory = {title: document.title, url: location.href, state: history.state};
        if (ctx.settings.colorPreviewLink) {
            const newTitle = `${preData.title ?? document.title} - ${galName()}`;
            // 돌아갈 위치도 함께 — 뒤로 가기로 다시 연 미리보기는 savedHistory가 비어 있어 닫아도 글 주소에 남는다
            if (!historySkip) history.pushState({refresher: 1, doc: historyDoc, preData, back: savedHistory}, newTitle, preData.link);
            // 히스토리로 다시 열 때도 — popstate는 제목을 되돌리지 않는다
            document.title = newTitle;
        }

        if (ctx.settings.autoRefreshComment === true) {
            const interval = Number(ctx.settings.commentRefreshInterval) || 10000;
            refreshTimer = window.setInterval(() => {
                if (document.hidden || pulling) return;
                void refreshComments();
            }, interval);
        }

        void load(preData, mySignal, dir);
    };

    // 관리 요청은 하나씩 — 패널을 연타해도 같은 POST가 두 번 가지 않게
    let managing = false;

    const manage = async (kind: ManageKind) => {
        const st = store.getState();
        if (!st.preData || !st.post || managing) return;

        const target = st.preData;
        // 응답 전에 다른 글로 넘어갔으면 표시는 그 글 것이 아니다 — 알림만
        const stillOpen = (): boolean => store.getState().signalId === st.signalId;
        managing = true;

        try {
            // 공지·개념글 표시는 성공했을 때만 바꾼다
            if (kind === "notice") {
                if (notifyManage(await setNotice(target, !st.notice), st.notice ? "공지를 해제했습니다." : "공지로 등록했습니다.") && stillOpen()) {
                    store.setState({notice: !st.notice});
                }
            } else if (kind === "recommend") {
                if (notifyManage(await setRecommend(target, !st.recommend), st.recommend ? "개념글을 해제했습니다." : "개념글로 등록했습니다.") && stillOpen()) {
                    store.setState({recommend: !st.recommend});
                }
            } else if (kind === "delete") {
                close();
                notifyManage(await deletePost(target), "게시글을 삭제했습니다.");
            } else if (kind === "bump") {
                notifyManage(await bump(target), "게시글을 끌올했습니다.");
            }
        } catch {
            ui.showToast("관리 기능 처리 중 오류가 발생했습니다.", "error");
        } finally {
            managing = false;
        }

        eventBus.emit("refreshRequest");
    };

    const blockPreset = async (target: GalleryPreData) => {
        const signal = store.getState().signalId;
        try {
            const result = await blockUser(target, {
                avoidHour: String(ctx.settings.blockPresetDay ?? "1"),
                avoidReason: "0",
                avoidReasonTxt: String(ctx.settings.blockPresetReason ?? ""),
                delChk: ctx.settings.blockPresetDelete ? "1" : "0",
                userTypeChk: ctx.settings.blockPresetUserType ? "1" : "0"
            });

            // 그새 다른 글로 넘어갔으면 그 글은 닫지 않는다
            if (notifyManage(result, "차단했습니다.") && ctx.settings.blockPresetDelete && store.getState().signalId === signal) close();
        } catch {
            ui.showToast("차단 처리 중 오류가 발생했습니다.", "error");
        }

        eventBus.emit("refreshRequest");
    };

    const onKey = (ev: KeyboardEvent) => {
        if (ctx.settings.useKeyPress !== true || !store.getState().visible) return;
        // Ctrl+D(북마크) 같은 조합키, 길게 눌러 생기는 반복 입력은 무시
        if (ev.ctrlKey || ev.altKey || ev.metaKey || ev.repeat) return;

        // 설정값은 옵션 화면이 같은 함수로 받은 영문 소문자·숫자
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
            ui.showToast(`한 번 더 ${key.toUpperCase()}키를 누르면 게시글을 ${isDelete ? "삭제" : "차단"}합니다.`);
        }
    };

    const onPopState = (ev: PopStateEvent) => {
        // 우리가 쌓은 글이면 그 글을 연다 — 열려 있을 때도 (PageDown으로 넘긴 뒤 뒤로 가기는 이전 글로)
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
            post = await processContents(preData, post, ctx.settings.tooltipMediaHide === true);
        } catch {
            return;
        }

        // 가져오는 사이 행을 떠났거나 전체 미리보기가 열렸으면 띄우지 않는다
        if (miniTarget !== element || usePreviewStore.getState().visible) return;

        usePreviewStore.setState({
            mini: {
                ...miniPosition(x, y),
                title: postTitle(post),
                // 미니는 마우스를 올려 볼 수 없으니 블러도 안내로 가린다
                contents: post.textBlocked && !useUiStore.getState().blockView?.revealed ? BLOCKED_TEXT : post.contents ?? "",
                // 이미지 차단(blockImage)은 전체 미리보기와 같은 것을 가린다 — 안 그러면 거기서 숨긴 이미지가 호버로 보인다
                blockMedia: ctx.settings.blockImage === true && isTextPost(preData)
            }
        });
    };

    const onMiniEnter = (ev: MouseEvent) => {
        if (ctx.settings.tooltipMode !== true) return;
        if (usePreviewStore.getState().visible) return;

        const element = ev.currentTarget as HTMLElement;
        if (isBlurHidden(element)) return;
        const x = ev.clientX;
        const y = ev.clientY;

        miniTarget = element;
        if (miniTimer) window.clearTimeout(miniTimer);
        // 적어도 100ms는 머물러야 — 목록을 가로지를 때 행마다 GET이 나가지 않게 (이미 저장된 0이 있어 기본값이 아니라 여기서)
        const delay = Math.max(Number(ctx.settings.tooltipDelay) || 0, 100);
        miniTimer = window.setTimeout(() => void showMini(element, x, y), delay);
    };

    const onMiniMove = (ev: MouseEvent) => {
        usePreviewStore.getState().moveMini(ev.clientX, ev.clientY);
    };

    const onMiniLeave = () => {
        if (miniTimer) window.clearTimeout(miniTimer);
        miniTimer = 0;
        // 받는 중인 본문은 끊지 않는다 — 열기가 같은 요청을 이어 쓴다. 다음 호버가 다른 글을 받으면 그때 끊긴다
        miniTarget = null;
        usePreviewStore.setState({mini: null});
    };

    // ── 행 이벤트 ────────────────────────────────────────────────
    // mousedown 기록 → mouseup에서 길게 누름 판정 → contextmenu에서 소비
    const onMouseDown = (ev: MouseEvent) => {
        if (ev.button !== 2) return;
        pressStart = Date.now();
        preventOpen = false;

        // 윈도우는 우클릭(contextmenu)이 버튼을 뗄 때 온다 — 누르고 있는 동안 본문을 미리 받는다. Shift는 브라우저 메뉴, 키 반전이면 이동
        if (ev.shiftKey) return;
        const resolved = resolveTarget(ev);
        if (!resolved || (!resolved.commentsOnly && ctx.settings.reversePreviewKey === true)) return;
        // 캐시를 끄면 열기가 캐시를 안 본다 — 떼기 전에 다 받으면 열 때 한 번 더 받으므로 미리 받지 않는다
        if (ctx.settings.disableCache !== true && !getEntry(resolved.preData)?.post) void requestPost(resolved.preData);
    };

    const onMouseUp = (ev: MouseEvent) => {
        if (ev.button !== 2 || pressStart === 0) return;

        const delay = Number(ctx.settings.longPressDelay) || 300;
        if (Date.now() - delay > pressStart) preventOpen = true;
        pressStart = 0;
    };

    // 제목 칸(word) 안에서 난 이벤트는 제목 칸 핸들러가 이미 처리함 — 행(row) 핸들러가 이어받아 중복 처리하지 않게
    const handledByWord = (element: HTMLElement, target: HTMLElement): boolean =>
        element.classList.contains("ub-content") && target.closest(".ub-word") !== null;

    // 우클릭·좌클릭이 같은 기준으로 대상을 고르게 한 곳에서 판정
    const resolveTarget = (ev: MouseEvent): { preData: GalleryPreData; commentsOnly: boolean } | null => {
        const element = ev.currentTarget as HTMLElement;
        const target = ev.target as HTMLElement;
        if (handledByWord(element, target)) return null;

        // 댓글 수 링크 → 댓글만 보기 (행 모드 가드보다 먼저)
        const commentsOnly = target.closest(".reply_numbox") !== null;

        if (!commentsOnly) {
            if (element.classList.contains("ub-content") && ctx.settings.expandRecognizeRange !== true) return null;

            // 작성자 칸은 유저 버블(block 모듈) 몫 — 행 전체 인식이어도 미리보기를 열지 않는다
            if (target.closest(".ub-writer")) return null;
        }

        const preData = buildPreData(element);
        return preData ? {preData, commentsOnly} : null;
    };

    const onContextMenu = (ev: MouseEvent) => {
        // Shift+우클릭은 브라우저 메뉴 — 맥·리눅스는 누르는 순간 메뉴가 떠서 길게 누르기로는 열 수 없다
        if (ev.shiftKey) return;

        const resolved = resolveTarget(ev);
        if (!resolved) return;

        if (resolved.commentsOnly) {
            ev.preventDefault();
            open(resolved.preData, true);
            return;
        }

        if (ctx.settings.reversePreviewKey === true) {
            ev.preventDefault();
            location.href = resolved.preData.link;
            return;
        }

        // 길게 눌렀으면 기본 우클릭 메뉴, 짧게 눌렀으면 미리보기
        if (preventOpen) {
            preventOpen = false;
            return;
        }

        ev.preventDefault();
        open(resolved.preData);
    };

    const onClick = (ev: MouseEvent) => {
        // 수정키 클릭은 새 탭·창으로 열거나 Ctrl+클릭 삭제(manage) — 가로채지 않는다
        if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey) return;

        const resolved = resolveTarget(ev);
        if (!resolved || (!resolved.commentsOnly && ctx.settings.reversePreviewKey !== true)) return;

        ev.preventDefault();
        open(resolved.preData, resolved.commentsOnly);
    };

    // 같은 리스너는 두 번 붙지 않으니 필터가 다시 불러도 그대로 둔다
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
        // 행 리스너(mouseleave)가 사라져 떠 있거나 가져오는 중인 미니를 닫을 길이 없으므로 여기서 닫는다
        onMiniLeave();
        close();
        store.setState(NO_HOOKS);
    });

    store.setState({
        requestOpen: (preData, commentsOnly, dir) => open(preData, commentsOnly, false, dir),
        requestClose: () => close(),
        requestRefresh: () => void refreshComments(),
        requestManage: (kind) => void manage(kind)
    });
};

/** 창(Frame)이 그릴 때 읽는 설정 — 바뀌면 열린 창에도 바로 반영된다 */
const publishSettings = (ctx: ModuleContext): void => {
    usePreviewStore.setState({
        shortcutKeys: ctx.settings.useKeyPress === true
            ? {delete: String(ctx.settings.deleteKey).toUpperCase(), block: String(ctx.settings.blockKey).toUpperCase()}
            : null,
        frameWidth: Number(ctx.settings.previewWidth),
        backgroundBlur: ctx.settings.toggleBackgroundBlur === true,
        scrollToSkip: ctx.settings.scrollToSkip === true
    });
};

export default defineModule({
    id: "preview",
    name: "미리보기",
    description: "글 목록에서 클릭 또는 우클릭으로 미리보기 창을 띄워줍니다.",
    icon: SquareMousePointer,
    urls: [/\/board\/(view|lists)/],
    settings,
    setup: (ctx) => {
        publishSettings(ctx);
        controller(ctx);
    },
    onChanged: publishSettings
});
