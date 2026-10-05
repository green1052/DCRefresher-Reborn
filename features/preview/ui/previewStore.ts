import {create} from "zustand";

import {needOverlayWhen} from "@/components/overlay/demands";
import type {ProcessedComment} from "@/core/preview/comments";
import type {BlockOptions} from "@/core/preview/request";
import type {GalleryPreData, PostInfo} from "@/core/preview/types";

export interface ErrorState {
    detail: string;
    /** HTTP 상태 코드 (HTTPError일 때). 임시 차단(BlockedError)은 429 */
    status?: number;
    /** 성인 인증이 필요한 글 (비로그인·미인증이면 본문 대신 인증 안내가 온다). */
    adult?: boolean;
    /** 미니 갤러리 비밀글 (비밀번호는 원문에서만 넣을 수 있다). */
    secret?: boolean;
}

export type ManageKind = "notice" | "recommend" | "delete" | "bump";

/** 공지·개념글 [등록, 해제] 동작. 관리 패널의 확인 문구와 결과 알림이 같이 쓴다. */
export const MANAGE_LABELS = {notice: ["공지로 등록", "공지를 해제"], recommend: ["개념글로 등록", "개념글을 해제"]} as const;

type Reply = { commentNo: string | null; replyNo: string | null };

/** 크게 보기(ImageViewer)의 이미지. pop은 디시 원본 보기 주소 (parser.ts가 옮겨 둔 data-pop). */
export interface ViewerImage {
    src: string;
    alt: string;
    pop?: string;
}

/**
 * blockMedia: blockImage로 이미지를 가릴지. 전체 미리보기와 같은 클래스로 가린다.
 * interactive: 마우스로 카드를 조작할 수 있다 (tooltipInteraction). 커서를 따라다니지 않는다.
 */
type MiniState = { x: number; y: number; title: string; contents: string; blockMedia: boolean; interactive: boolean; gallery: string };

/** 게시글을 새로 열 때마다 초기화되는 상태. */
interface PostState {
    error: ErrorState | undefined;
    post: PostInfo | undefined;
    /** 받지 못해 보존해 둔 본문을 보이는 중 ('삭제된 글과 댓글 보존'). */
    archived: boolean;

    comments: ProcessedComment[] | undefined;
    /** 댓글·답글 쓰기 허용. 멤버만 댓글을 쓸 수 있는 갤러리면 댓글 응답의 allow_reply가 0이다. */
    allowReply: boolean;
    collapsed: Set<string>;
    /** 댓글 새로고침으로 새로 들어온 댓글 번호. 잠깐 강조한다 (overlay.css의 data-fresh). */
    freshComments: ReadonlySet<string>;
    reply: Reply;
    /** 댓글만 보기 (목록의 댓글 수 링크로 열었을 때). */
    commentsOnly: boolean;
    /** 본문 이미지 차단 (blockImage). */
    imageBlocked: boolean;

    notice: boolean;
    recommend: boolean;
    adminVisible: boolean;
    blockPopup: boolean;
    /** 본문 이미지 크게 보기. 글을 넘기거나 닫으면 닫힌다. */
    viewer: { images: ViewerImage[]; index: number } | null;
}

/** 컨트롤러(index.ts)가 UI에 넘기는 동작. 모듈이 켜질 때 setState로 넣고, 정리할 때 NO_HOOKS로 되돌린다. */
interface Hooks {
    requestOpen: (preData: GalleryPreData, commentsOnly?: boolean, dir?: number) => void;
    requestClose: () => void;
    /** 댓글만 다시 받는다. report: 실패를 알린다. */
    requestRefresh: (report?: boolean) => Promise<void>;
    /** 본문을 캐시 없이 다시 받고 댓글도 다시 받는다. */
    requestReload: () => Promise<void>;
    requestManage: (kind: ManageKind) => void;
    /** 차단하고 성공 여부를 돌려준다. 글도 지웠으면 창을 닫는다. */
    requestBlock: (preData: GalleryPreData, options: BlockOptions) => Promise<boolean>;
}

interface PreviewState extends PostState, Hooks {
    visible: boolean;
    /** 우클릭을 누른 순간 오버레이를 미리 띄운다 (윈도우는 떼야 contextmenu가 온다). */
    warm: boolean;
    /** 닫힌 뒤 페이드아웃 중 (200ms). */
    fading: boolean;
    preData: GalleryPreData | null;
    /** 열고 닫을 때마다 오른다. 늦게 도착한 이전 글의 응답을 버리는 데 쓴다. */
    signalId: number;

    captcha: { url: string; resolve: (code: string) => void } | null;
    mini: MiniState | null;

    /** 정보 창(DcconInfoPopup)을 띄운 디시콘 코드. null이면 닫혀 있다. */
    dcconInfo: string | null;

    /** 글 상태를 비우고 patch를 얹어 한 번의 setState로 연다. */
    open: (preData: GalleryPreData, patch?: Partial<PostState>) => void;
    close: () => void;
    toggleCollapse: (no: string) => void;
    openCaptcha: (url: string) => Promise<string>;
    moveMini: (clientX: number, clientY: number) => void;
}

let miniCloseTimer = 0;
// 커서가 조작할 수 있는 카드 위에 있다. 카드의 pointerenter가 제목의 mouseout보다 먼저 오기도 해서 따로 기억한다.
let miniHovered = false;

/** 조작할 수 있는 미니를 조금 뒤에 닫는다. 커서가 제목에서 카드로(카드에서 제목으로) 옮겨 가는 사이 닫히지 않게 v5처럼 150ms 기다린다. */
export const closeMiniSoon = (): void => {
    window.clearTimeout(miniCloseTimer);
    if (!miniHovered) miniCloseTimer = window.setTimeout(() => usePreviewStore.setState({mini: null}), 150);
};

/** closeMiniSoon을 취소한다 (커서가 제목으로 돌아왔다). */
export const keepMini = (): void => {
    window.clearTimeout(miniCloseTimer);
    miniCloseTimer = 0;
};

/** 카드에 커서가 들어오거나 나갔다. hovered가 없으면 새 미니를 띄우거나 바로 닫을 때 기억을 지운다. */
export const hoverMini = (hovered?: boolean): void => {
    miniHovered = hovered === true;
    if (hovered === true) keepMini();
    else if (hovered === false) closeMiniSoon();
};


/** 미니 미리보기 크기. Mini.tsx와 화면 밖 방지 계산(miniPosition, mini.ts의 showMini)이 같이 쓴다. */
export const MINI_WIDTH = 720;
export const MINI_HEIGHT = 560;

/** 커서 오른쪽 아래에 띄우되 화면 밖으로 나가지 않게 한다. */
export const miniPosition = (clientX: number, clientY: number): { x: number; y: number } => ({
    x: Math.max(0, Math.min(clientX + 16, window.innerWidth - MINI_WIDTH - 20)),
    y: Math.max(0, Math.min(clientY + 16, window.innerHeight - MINI_HEIGHT - 20))
});

export const NO_REPLY: Reply = {commentNo: null, replyNo: null};

/** 새 댓글이 없을 때 쓰는 빈 집합. 새로고침마다 새 객체를 넣지 않는다. */
export const NO_FRESH: ReadonlySet<string> = new Set();

export const NO_HOOKS: Hooks = {
    requestOpen: () => undefined,
    requestClose: () => undefined,
    requestRefresh: async () => undefined,
    requestReload: async () => undefined,
    requestManage: () => undefined,
    requestBlock: async () => false
};

const freshPost = (): PostState => ({
    error: undefined,
    post: undefined,
    archived: false,
    comments: undefined,
    allowReply: true,
    collapsed: new Set(),
    freshComments: NO_FRESH,
    reply: NO_REPLY,
    commentsOnly: false,
    imageBlocked: false,
    notice: false,
    recommend: false,
    adminVisible: false,
    blockPopup: false,
    viewer: null
});

let signalSeq = 0;

const KST = 9 * 3_600_000;

/**
 * 디시 시각 문자열을 읽는다 ("2026.09.26 02:29:40", 올해 것은 연도 없이 "09.26 02:29:40").
 * 한국 시간이므로 +09:00을 붙인다. 브라우저 시간대로 읽으면 해외에서 어긋난다.
 */
export const parseDate = (value: string): Date => {
    const missingYear = value.substring(0, 4).includes(".");
    // 빠진 연도도 한국 날짜 기준으로 채운다. 로컬 연도를 쓰면 해가 바뀌는 무렵 시차로 한 해 어긋난다.
    const year = missingYear ? `${new Date(Date.now() + KST).getUTCFullYear()}-` : "";

    return new Date(`${year}${value.replace(/\./g, "-").replace(" ", "T")}+09:00`);
};

/** `[말머리] 제목`. 둘 다 평문이므로 HTML이 아니라 텍스트로 렌더링한다. */
export const postTitle = (post: PostInfo): string => (post.header ? `[${post.header}] ${post.title ?? ""}` : (post.title ?? ""));

/** 닫힐 때 페이드아웃을 끝내는 타이머. */
let fadeTimer = 0;

export const usePreviewStore = create<PreviewState>((set, get) => ({
    ...freshPost(),
    ...NO_HOOKS,
    visible: false,
    warm: false,
    fading: false,
    preData: null,
    signalId: 0,
    captcha: null,
    mini: null,
    dcconInfo: null,

    open: (preData, patch) => {
        // 이전 글의 캡차 창은 닫는다. 남아 있으면 입력한 코드가 이전 글로 간다.
        get().captcha?.resolve("");
        set({...freshPost(), ...patch, visible: true, fading: false, preData, signalId: ++signalSeq, mini: null, captcha: null, dcconInfo: null});
    },

    close: () => {
        // 열려 있지 않으면 할 일이 없다. 모듈을 끌 때도 부르는데, 페이드를 걸면 지난 글이 잠깐 비친다.
        if (!get().visible) return;
        get().captcha?.resolve("");
        // signalId도 올린다. 닫은 뒤 도착한 응답(abort로 난 오류 포함)이 페이드아웃 중인 창에 그려지면 안 된다.
        set({visible: false, fading: true, comments: undefined, blockPopup: false, captcha: null, reply: NO_REPLY, signalId: ++signalSeq, dcconInfo: null, viewer: null});
        // 앞서 닫을 때 건 타이머는 지운다. 남겨 두면 닫았다 곧바로 다시 열고 닫을 때 이번 페이드를 일찍 끊는다.
        window.clearTimeout(fadeTimer);
        fadeTimer = window.setTimeout(() => set({fading: false}), 200);
    },

    toggleCollapse: (no) =>
        set((state) => {
            const next = new Set(state.collapsed);
            if (!next.delete(no)) next.add(no);
            return {collapsed: next};
        }),

    openCaptcha: (url) => new Promise((resolve) => set({captcha: {url, resolve}})),

    moveMini: (clientX, clientY) => set((state) => (state.mini ? {mini: {...state.mini, ...miniPosition(clientX, clientY)}} : state))
}));

// 미리보기 UI 중 하나라도 떠 있으면 오버레이를 띄운다 (components/overlay/demands). 새 미리보기 UI를 추가하면 여기에 넣는다.
needOverlayWhen(usePreviewStore, (state) =>
    state.visible || state.warm || state.mini !== null || state.captcha !== null || state.blockPopup || state.dcconInfo !== null);
