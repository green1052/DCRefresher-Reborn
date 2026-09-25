import {HTTPError} from "ky";

import {eventBus} from "@/core/eventbus/bus";
import {isBlocked} from "@/core/block";
import {defineModule} from "@/core/module/define";
import type {ModuleContext, ModuleDefinition, SettingGroup} from "@/core/module/types";
import type {GalleryPreData, PostInfo} from "@/core/preview/types";
import {useUiStore} from "@/stores/ui";
import {isTyping} from "@/utils/event";
import {isGalleryManager} from "@/utils/user";
import {notifyManage} from "@/utils/notify";
import {sanitizeHtml} from "@/utils/sanitize";

import {getEntry, setEntry} from "@/core/preview/cache";
import {ADULT_ERROR} from "@/core/preview/parser";
import {processComments} from "@/core/preview/comments";
import {blockUser, bump, deletePost, fetchComments, fetchPost, setNotice, setRecommend} from "@/core/preview/request";
import {BLOCK_DAYS, BLOCKED_TEXT, type ErrorState, type ManageKind, miniPosition, postTitle, usePreviewStore} from "./ui/previewStore";

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
    const rowHandlers = new AbortController();
    let savedHistory: { title: string; url: string; state: unknown } | null = null;
    // 이 문서에서 쌓은 히스토리인지 — 새로고침한 글 페이지에 남은 예전 상태로 미리보기를 다시 열지 않게
    const historyDoc = performance.timeOrigin;
    let refreshTimer = 0;
    let pressStart = 0;
    let preventOpen = false;
    let lastKey = "";
    let lastKeyTime = 0;
    let miniTimer = 0;
    let miniAbort: AbortController | null = null;

    // 갤러리 이름은 제목 링크의 첫 글자 칸 — h1(로고)엔 인라인 스크립트가, 링크엔 마이너·미니 표시가 섞인다
    const galName = (): string => document.querySelector(".page_head h2 a")?.firstChild?.textContent?.trim() || "디시인사이드";

    // 본문 차단도 차단 모듈을 따른다 — 꺼져 있으면 가리지 않는다. 원문은 남겨 '가린 내용 보기'로 다시 보인다 (Frame.tsx)
    const processContents = (preData: GalleryPreData, postInfo: PostInfo, stripMedia = false): PostInfo => {
        const view = useUiStore.getState().blockView;
        // 페이지와 같은 글자로 본다 (block 모듈 checkText) — 본문 칸째 풀면 디시 스크립트·템플릿 글자가 섞이고 태그 자리가 공백이 돼 '<b>광</b>고'로 비켜 간다
        const writeDiv = postInfo.dom.querySelector(".write_div");
        const textBlocked = view && writeDiv && isBlocked("TEXT", writeDiv.textContent?.trim() ?? "", preData.gallery) ? (view.blur ? "blur" : "hide") : undefined;

        return {...postInfo, contents: sanitizeHtml(postInfo.contents ?? "", {stripMedia}), textBlocked};
    };

    /** 캐시에 있으면 캐시, 없으면 받는다. fresh: 방금 받은 본문 — 캐시 것은 1분까지 낡았을 수 있다 */
    const getPost = async (preData: GalleryPreData, signal: AbortSignal): Promise<{ post: PostInfo; fresh: boolean }> => {
        const cached = ctx.settings.disableCache !== true ? getEntry(preData)?.post : undefined;
        if (cached) return {post: cached, fresh: false};

        try {
            const post = await fetchPost(preData, signal);
            setEntry(preData, {post});
            return {post, fresh: true};
        } catch (e) {
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

    /** 댓글을 받아 가공해 그린다. skip이면 받지 않고 빈 목록으로 (보존한 댓글은 되살아난다) */
    const pullComments = async (preData: GalleryPreData, post: PostInfo, mySignal: number, skip = false): Promise<void> => {
        const seq = ++commentSeq;
        pulling++;

        try {
            const {list: raw, allowReply} = skip ? {list: [], allowReply: true} : await fetchComments(preData, post, abort!.signal);
            if (store.getState().signalId !== mySignal || seq < shownSeq) return;
            shownSeq = seq;

            const {list, threads, totalCnt, blocked, folded} = processComments(raw, preData, ctx);
            const extra = [blocked && `차단 ${blocked}개`, folded && `같은 댓글 ${folded}개 접음`].filter(Boolean).join(", ");
            store.getState().setComments(list, `쓰레드 ${threads}개, 총 댓글 ${totalCnt}개${extra ? ` (${extra})` : ""}`, allowReply);
        } finally {
            pulling--;
        }
    };

    const refreshComments = async () => {
        const st = store.getState();
        if (!st.visible || !st.preData || !st.post || !abort) return;

        try {
            await pullComments(st.preData, st.post, st.signalId);
        } catch {
            // 자동 갱신 실패는 조용히 무시
        }
    };

    const load = async (preData: GalleryPreData, mySignal: number) => {
        let post: PostInfo;
        let fresh: boolean;

        try {
            ({post, fresh} = await getPost(preData, abort!.signal));
            post = processContents(preData, post);
        } catch (e) {
            if (store.getState().signalId === mySignal) store.getState().setError(errorOf(e));
            return;
        }

        if (store.getState().signalId !== mySignal) return;
        store.getState().setPost(post);

        try {
            // 방금 받은 본문이 댓글 0개면 받지 않는다 — 보존해 둔 댓글이 있으면 받아서 비교한다
            await pullComments(preData, post, mySignal, fresh && post.commentCount === 0 && !Object.keys(getEntry(preData)?.seen ?? {}).length);
        } catch {
            // 댓글만 못 받았으면 본문은 그대로 두고 알린다
            if (store.getState().signalId === mySignal) ui.showToast("댓글을 불러오지 못했습니다.", "error");
        }
    };

    const restoreHistory = (fromHistory: boolean) => {
        if (savedHistory && ctx.settings.colorPreviewLink === true) {
            // 뒤로 가기로 닫았으면 주소는 이미 돌아갔다 — 제목만 (popstate는 제목을 되돌리지 않는다)
            if (!fromHistory) history.pushState(savedHistory.state, savedHistory.title, savedHistory.url);
            document.title = savedHistory.title;
        }

        savedHistory = null;
    };

    const close = (fromHistory = false) => {
        abort?.abort();
        abort = null;

        if (refreshTimer) window.clearInterval(refreshTimer);
        refreshTimer = 0;

        restoreHistory(fromHistory);
        store.getState().close();
    };

    const open = (preData: GalleryPreData, commentsOnly = false, historySkip = false) => {
        // 호버 대기·요청 중인 미니가 전체 미리보기 위에 뜨지 않게
        onMiniLeave();

        const st = store.getState();

        if (st.visible && st.preData?.id === preData.id && st.preData?.gallery === preData.gallery) {
            st.setCommentsOnly(commentsOnly);
            return;
        }

        abort?.abort();
        abort = new AbortController();
        if (refreshTimer) window.clearInterval(refreshTimer);
        refreshTimer = 0;
        // 두 번 누르기 확인은 글마다 — 이전 글에서 한 번 누른 키로 다음 글이 바로 지워지지 않게
        lastKey = "";

        store.getState().open(preData);

        const mySignal = store.getState().signalId;
        const after = store.getState();

        if (commentsOnly) after.setCommentsOnly(true);
        // 목록에 이미지 아이콘이 없는(텍스트) 글만 본문 이미지 숨김
        after.setImageBlocked(ctx.settings.blockImage === true && isTextPost(preData));
        after.setNotice(preData.notice);
        after.setRecommend(preData.recommend);
        after.setAdminVisible(ctx.settings.toggleAdminPanel === true && isGalleryManager());

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

        void load(preData, mySignal);
    };

    const manage = async (kind: ManageKind) => {
        const st = store.getState();
        if (!st.preData || !st.post) return;

        const target = st.preData;
        // 응답 전에 다른 글로 넘어갔으면 표시는 그 글 것이 아니다 — 알림만
        const stillOpen = (): boolean => store.getState().signalId === st.signalId;

        try {
            // 공지·개념글 표시는 성공했을 때만 바꾼다
            if (kind === "notice") {
                if (notifyManage(await setNotice(target, !st.notice), st.notice ? "공지를 해제했습니다." : "공지로 등록했습니다.") && stillOpen()) {
                    store.getState().setNotice(!st.notice);
                }
            } else if (kind === "recommend") {
                if (notifyManage(await setRecommend(target, !st.recommend), st.recommend ? "개념글을 해제했습니다." : "개념글로 등록했습니다.") && stillOpen()) {
                    store.getState().setRecommend(!st.recommend);
                }
            } else if (kind === "delete") {
                close();
                notifyManage(await deletePost(target), "게시글을 삭제했습니다.");
            } else if (kind === "bump") {
                notifyManage(await bump(target), "게시글을 끌올했습니다.");
            }
        } catch {
            ui.showToast("관리 기능 처리 중 오류가 발생했습니다.", "error");
        }

        eventBus.emit("refreshRequest");
    };

    const blockPreset = async (target: GalleryPreData) => {
        try {
            const result = await blockUser(target, {
                avoidHour: String(ctx.settings.blockPresetDay ?? "1"),
                avoidReason: "0",
                avoidReasonTxt: String(ctx.settings.blockPresetReason ?? ""),
                delChk: ctx.settings.blockPresetDelete ? "1" : "0",
                userTypeChk: ctx.settings.blockPresetUserType ? "1" : "0"
            });

            if (notifyManage(result, "차단했습니다.") && ctx.settings.blockPresetDelete) close();
        } catch {
            ui.showToast("차단 처리 중 오류가 발생했습니다.", "error");
        }

        eventBus.emit("refreshRequest");
    };

    const onKey = (ev: KeyboardEvent) => {
        if (ctx.settings.useKeyPress !== true || !store.getState().visible) return;
        // Ctrl+D(북마크) 같은 조합키, 길게 눌러 생기는 반복 입력은 무시
        if (ev.ctrlKey || ev.altKey || ev.metaKey || ev.repeat) return;

        // 한글 입력 상태면 ev.key가 'ㅇ'·'Process'라 물리 키(code)로 본다 — 설정값은 영문 소문자·숫자
        const key = (/^(?:Key|Digit)([A-Z\d])$/.exec(ev.code)?.[1] ?? ev.key).toLowerCase();
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

        miniAbort?.abort();
        miniAbort = new AbortController();

        let post: PostInfo;
        try {
            ({post} = await getPost(preData, miniAbort.signal));
        } catch {
            return;
        }

        const {contents = "", textBlocked} = processContents(preData, post, ctx.settings.tooltipMediaHide === true);

        // 가져오는 사이 전체 미리보기가 열렸으면 그 위에 띄우지 않는다
        if (usePreviewStore.getState().visible) return;

        usePreviewStore.getState().openMini({
            ...miniPosition(x, y),
            title: postTitle(post),
            // 미니는 마우스를 올려 볼 수 없으니 블러도 안내로 가린다
            contents: textBlocked && !useUiStore.getState().blockView?.revealed ? BLOCKED_TEXT : contents,
            // 이미지 차단(blockImage)은 전체 미리보기와 같은 것을 가린다 — 안 그러면 거기서 숨긴 이미지가 호버로 보인다
            blockMedia: ctx.settings.blockImage === true && isTextPost(preData)
        });
    };

    const onMiniEnter = (ev: MouseEvent) => {
        if (ctx.settings.tooltipMode !== true) return;
        if (usePreviewStore.getState().visible) return;

        const element = ev.currentTarget as HTMLElement;
        const x = ev.clientX;
        const y = ev.clientY;

        if (miniTimer) window.clearTimeout(miniTimer);
        const delay = Number(ctx.settings.tooltipDelay) || 0;
        miniTimer = window.setTimeout(() => void showMini(element, x, y), delay);
    };

    const onMiniMove = (ev: MouseEvent) => {
        usePreviewStore.getState().moveMini(ev.clientX, ev.clientY);
    };

    const onMiniLeave = () => {
        if (miniTimer) window.clearTimeout(miniTimer);
        miniTimer = 0;
        miniAbort?.abort();
        miniAbort = null;
        usePreviewStore.getState().closeMini();
    };

    // ── 행 이벤트 ────────────────────────────────────────────────
    // mousedown 기록 → mouseup에서 길게 누름 판정 → contextmenu에서 소비
    const onMouseDown = (ev: MouseEvent) => {
        if (ev.button !== 2) return;
        pressStart = Date.now();
        preventOpen = false;
    };

    const onMouseUp = (ev: MouseEvent) => {
        if (ev.button !== 2 || pressStart === 0) return;

        const delay = Number(ctx.settings.longPressDelay) || 300;
        if (Date.now() - delay > pressStart) preventOpen = true;
        pressStart = 0;
    };

    // 제목 칸(word) 안에서 난 이벤트는 제목 칸 핸들러가 이미 처리함 — 행(row) 핸들러가 이어받아 중복 처리하지 않게
    const handledByWord = (element: HTMLElement, target: HTMLElement): boolean =>
        element.dataset.refresherPreviewMode === "row" && target.closest("[data-refresher-preview-mode=\"word\"]") !== null;

    // 우클릭·좌클릭이 같은 기준으로 대상을 고르게 한 곳에서 판정
    const resolveTarget = (ev: MouseEvent): { preData: GalleryPreData; commentsOnly: boolean } | null => {
        const element = ev.currentTarget as HTMLElement;
        const target = ev.target as HTMLElement;
        if (handledByWord(element, target)) return null;

        // 댓글 수 링크 → 댓글만 보기 (행 모드 가드보다 먼저)
        const commentsOnly = target.closest(".reply_numbox") !== null;

        if (!commentsOnly) {
            if (element.dataset.refresherPreviewMode === "row" && ctx.settings.expandRecognizeRange !== true) return null;

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

    const bind = (element: HTMLElement, mode: "word" | "row") => {
        if (element.dataset.refresherPreviewBound === "1") return;
        element.dataset.refresherPreviewBound = "1";
        element.dataset.refresherPreviewMode = mode;

        const options = {signal: rowHandlers.signal};

        element.addEventListener("mousedown", onMouseDown, options);
        element.addEventListener("mouseup", onMouseUp, options);
        element.addEventListener("contextmenu", onContextMenu, options);
        element.addEventListener("click", onClick, options);

        if (mode === "word") {
            element.addEventListener("mouseenter", onMiniEnter, options);
            element.addEventListener("mousemove", onMiniMove, options);
            element.addEventListener("mouseleave", onMiniLeave, options);
        }
    };

    ctx.addFilter(
        ".gall_list .ub-word",
        (element) => bind(element, "word")
    );

    ctx.addFilter(
        ".gall_list .ub-content",
        (element) => bind(element, "row")
    );

    window.addEventListener("keydown", onKey);
    window.addEventListener("popstate", onPopState);

    ctx.addCleanup(() => {
        window.removeEventListener("keydown", onKey);
        window.removeEventListener("popstate", onPopState);

        // 바인딩된 행의 리스너 전부 해제 + 재바인딩 허용
        rowHandlers.abort();
        for (const element of document.querySelectorAll<HTMLElement>("[data-refresher-preview-bound]")) {
            delete element.dataset.refresherPreviewBound;
            delete element.dataset.refresherPreviewMode;
        }

        // 행 리스너(mouseleave)가 사라져 떠 있거나 가져오는 중인 미니를 닫을 길이 없으므로 여기서 닫는다
        onMiniLeave();
        close();
        store.getState().setHooks({});
    });

    store.getState().setHooks({
        open,
        close: () => close(),
        refresh: () => void refreshComments(),
        manage: (kind) => void manage(kind)
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
    defaultEnable: true,
    urls: [/\/board\/(view|lists)/],
    settings,
    setup: (ctx) => {
        publishSettings(ctx);
        controller(ctx);
    },
    onChanged: publishSettings
});
