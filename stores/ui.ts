import {create} from "zustand";

import {needOverlayWhen} from "@/components/overlay/demands";
import type {IpCategory, IpInfoFilter} from "@/core/database";
import type {MemoType} from "@/core/storage/types";
import {eventTarget} from "@/utils/event";
import {nickType} from "@/utils/user";

type ToastLevel = "info" | "error" | "warning";

export type BadgeKey = "UID" | "MEMO" | "RATIO" | "PERMBAN";

/** userinfo의 배지 순서·표시 조건. 미리보기 작성자 표시가 이것으로 페이지와 같게 그린다. */
export interface BadgeView {
    order: BadgeKey[];
    /** 고정닉/반고정닉 아이디 표시. */
    fixedUid: boolean;
    halfFixedUid: boolean;
    ipFilter: IpInfoFilter;
}

/** userinfo가 꺼져 있을 때의 값. 기본 순서이고 IP 정보(userinfo가 붙이는 배지)는 없다. */
export const DEFAULT_BADGE_VIEW: BadgeView = {order: ["UID", "MEMO", "RATIO", "PERMBAN"], fixedUid: true, halfFixedUid: true, ipFilter: "none"};

/** 닉콘(고정닉·반고정닉)에 따라 UID를 보일지. 닉콘이 없으면 늘 보인다. */
export const showsUid = (view: BadgeView, icon?: string): boolean => {
    const type = icon ? nickType(icon) : "UNFIXED";
    return type === "FIXED" ? view.fixedUid : type === "HALF_FIXED" ? view.halfFixedUid : true;
};

/** 차단 모듈의 표시 방식. 미리보기도 이것으로 페이지와 같게 가린다. */
export interface BlockView {
    blur: boolean;
    /** 블러에 마우스를 올리면 보기. */
    blurReveal: boolean;
    replyRemove: boolean;
    /** 이 페이지에서만 차단 내용 보기 (저장하지 않음). */
    revealed: boolean;
    /** 같은 댓글 접기. 끄면 null이다. */
    duplicate: { count: number; minLength: number } | null;
}

export interface ToastData {
    content: string;
    type: ToastLevel;
    autoClose: number;
    /** 토스트에 붙는 버튼 (되돌리기 등). 누르면 토스트를 닫고 run을 부른다. */
    action?: { label: string; run: () => void };
}

export interface SelectedUser {
    nick?: string;
    uid?: string;
    ip?: string;
    /** 우클릭한 디시콘 코드 (dccon.php?no= 값). */
    dccon?: string;
}

export interface MemoTargetState {
    targets: Partial<Record<MemoType, string>>;
    initialType: MemoType;
}

/** 깡계인지: 글댓합이 기준(alarm) 이하다. 기준이 0이면 끈 것이다. 페이지(userinfo)와 미리보기가 같은 판정을 쓴다. */
export const isLowActivity = (ratio: { article: number; comment: number }, alarm: number): boolean => alarm > 0 && ratio.article + ratio.comment <= alarm;

/**
 * 글댓비가 1시간 안에 받은 값인지. 지난 값은 미리보기·버블이 새로 조회하고, userinfo는 그 유저의 새 글이 올라오면 다시 조회한다.
 * 목록 배지는 지난 값도 그대로 보인다. 1시간 뒤 지우면 새 글이 드문 갤러리에선 배지가 거의 남지 않는다.
 */
export const isFresh = <T extends { date: number }>(info?: T): info is T => info !== undefined && Date.now() - info.date <= 3600_000;

/** 배지 색 키. userinfo의 BADGE_COLORS가 키마다 색 설정을 하나씩 둔다. IP 배지는 분류가 키다. */
export type BadgeColorKey = IpCategory | "uid" | "permBan" | "ratio" | "ratioAlarm";

interface UiState {
    /** 오버레이가 아직 받지 않은 토스트. 마지막이 가장 최근 것이다. 띄우고 닫는 것은 ToastHost(Base UI Toast)가 맡는다. */
    toasts: ToastData[];
    selected: SelectedUser | null;
    bubble: { x: number; y: number } | null;
    memo: MemoTargetState | null;
    /** 배지 색 (userinfo 설정). 모듈이 꺼져 있으면 비어 있고, 갱차 조회를 끄면 permBan이 없다. */
    badgeColors: Partial<Record<BadgeColorKey, string>>;
    badgeView: BadgeView;
    /** 글댓비 캐시와 깡계 기준 (userinfo). 글댓비 표시를 끄거나 모듈이 꺼져 있으면 null. 지난 값도 있으니 isFresh로 가려 읽는다. */
    ratios: { cache: Record<string, { article: number; comment: number; date: number }>; alarm: number } | null;
    /** 차단 모듈이 꺼져 있으면 null이고, 미리보기도 가리지 않는다. */
    blockView: BlockView | null;

    showToast: (content: string, type?: ToastLevel, autoClose?: number, action?: ToastData["action"]) => void;
    /** user를 고르고 (x, y)에 유저 버블을 연다. 버블의 메모·차단은 고른 대상에 건다. */
    openBubble: (user: SelectedUser, x: number, y: number) => void;
    closeBubble: () => void;
    /** 버블에서 고른 대상의 메모 다이얼로그를 연다. */
    openMemo: (user: SelectedUser) => void;
    closeMemo: () => void;
}

export const useUiStore = create<UiState>((set, get) => ({
    toasts: [],
    selected: null,
    bubble: null,
    memo: null,
    badgeColors: {},
    badgeView: DEFAULT_BADGE_VIEW,
    ratios: null,
    blockView: null,

    showToast: (content, type = "info", autoClose = 5000, action) => {
        set({toasts: [...get().toasts, {content, type, autoClose, action}]});
    },

    openBubble: (selected, x, y) => set({selected, bubble: {x, y}}),
    closeBubble: () => set({bubble: null}),

    openMemo: (selected) => {
        const targets: Partial<Record<MemoType, string>> = {};
        if (selected.nick) targets.NICK = selected.nick;
        if (selected.uid) targets.UID = selected.uid;
        if (selected.ip) targets.IP = selected.ip;

        set({bubble: null, memo: {targets, initialType: selected.uid ? "UID" : selected.ip ? "IP" : "NICK"}});
    },

    closeMemo: () => set({memo: null})
}));

/**
 * 페이지의 작성자 칸(.ub-writer)을 우클릭하면 브라우저 메뉴 대신 유저 버블(차단·메모·갤로그)을 연다. document의 capture 리스너로 건다.
 * 차단과 유저 정보 모듈이 각자 건다. 메모는 차단 모듈을 꺼도 쓸 수 있어야 한다.
 * 둘 다 켜져 있으면 먼저 받은 쪽이 열고, 나머지는 defaultPrevented를 보고 건너뛴다. Shift+우클릭은 브라우저 메뉴로 남긴다.
 */
export const openWriterBubble = (ev: MouseEvent): void => {
    if (ev.defaultPrevented || ev.shiftKey) return;

    const target = eventTarget(ev);
    const writer = target instanceof Element ? target.closest<HTMLElement>(".ub-writer") : null;
    if (!writer) return;

    const {nick, uid, ip} = writer.dataset;
    if (!nick && !uid && !ip) return;

    ev.preventDefault();
    useUiStore.getState().openBubble({nick, uid, ip}, ev.clientX, ev.clientY);
};

// 토스트·유저 버블·메모 창이 뜨면 오버레이를 띄운다 (components/overlay/demands.ts). 배지 색·차단 보기처럼 setup이 늘 채우는 값은 넣지 않는다.
needOverlayWhen(useUiStore, ({toasts, bubble, memo}) => Boolean(toasts.length || bubble || memo));
