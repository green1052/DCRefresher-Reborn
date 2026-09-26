import {create} from "zustand";

import type {IpCategory, IpInfoFilter} from "@/core/database";
import type {MemoType} from "@/core/storage/types";
import {getType} from "@/utils/user";

type ToastLevel = "info" | "error" | "warning";

export type BadgeKey = "UID" | "MEMO" | "RATIO" | "PERMBAN";

/** 배지 순서·표시 조건 (userinfo) — 미리보기 작성자 표시가 페이지와 같게 그린다 */
export interface BadgeView {
    order: BadgeKey[];
    /** 고정닉/반고정닉 UID 표시 */
    fixedUid: boolean;
    halfFixedUid: boolean;
    ipFilter: IpInfoFilter;
}

/** userinfo가 꺼져 있을 때 — 기본 순서, IP 정보(userinfo가 붙이는 배지)는 없음 */
export const DEFAULT_BADGE_VIEW: BadgeView = {order: ["UID", "MEMO", "RATIO", "PERMBAN"], fixedUid: true, halfFixedUid: true, ipFilter: "none"};

/** 닉콘(고정닉·반고정닉)에 따라 UID를 보일지 — 닉콘이 없으면 보인다 */
export const showsUid = (view: BadgeView, icon?: string): boolean => {
    const type = icon ? getType(icon) : "UNFIXED";
    return type === "FIXED" ? view.fixedUid : type === "HALF_FIXED" ? view.halfFixedUid : true;
};

/** 차단 모듈의 표시 방식 — 미리보기도 페이지와 같게 가린다 */
export interface BlockView {
    blur: boolean;
    /** 블러에 마우스를 올리면 보기 */
    blurReveal: boolean;
    replyRemove: boolean;
    /** 이 페이지에서만 차단 내용 보기 (저장하지 않음) */
    revealed: boolean;
    /** 같은 댓글 접기 — 끄면 null */
    duplicate: { count: number; minLength: number } | null;
}

export interface ToastData {
    id: number;
    content: string;
    type: ToastLevel;
    autoClose: number;
    onClick?: () => void;
}

export interface SelectedUser {
    nick?: string;
    uid?: string;
    ip?: string;
    /** 우클릭한 디시콘 코드 (dccon.php?no= 값) */
    dccon?: string;
}

export interface MemoTargetState {
    targets: Partial<Record<MemoType, string>>;
    initialType: MemoType;
}

interface UiState {
    toast: ToastData | null;
    selected: SelectedUser | null;
    bubble: { x: number; y: number } | null;
    memo: MemoTargetState | null;
    /** IP 정보·갱차 색 (userinfo 설정) — 모듈이 꺼져 있으면 비어 있고, 갱차 조회를 끄면 permBan이 없다 */
    badgeColors: Partial<Record<IpCategory | "uid" | "permBan" | "ratio" | "ratioAlarm", string>>;
    badgeView: BadgeView;
    /** 글댓비 캐시와 경고 기준 (userinfo) — 글댓비 표시를 끄거나 모듈이 꺼져 있으면 null */
    ratios: { cache: Record<string, { article: number; comment: number }>; alarm: number } | null;
    /** 차단 모듈이 꺼져 있으면 null — 미리보기도 가리지 않는다 */
    blockView: BlockView | null;

    showToast: (content: string, type?: ToastLevel, autoClose?: number, onClick?: () => void) => void;
    dismissToast: (id?: number) => void;
    setSelected: (user: SelectedUser) => void;
    openBubble: (x: number, y: number) => void;
    closeBubble: () => void;
    /** 마지막으로 우클릭한 대상으로 메모 다이얼로그. 선택이 없으면 토스트 */
    openMemoForSelected: () => void;
    closeMemo: () => void;
}

let toastSeq = 0;

export const useUiStore = create<UiState>((set, get) => ({
    toast: null,
    selected: null,
    bubble: null,
    memo: null,
    badgeColors: {},
    badgeView: DEFAULT_BADGE_VIEW,
    ratios: null,
    blockView: null,

    showToast: (content, type = "info", autoClose = 5000, onClick) => {
        set({toast: {id: ++toastSeq, content, type, autoClose, onClick}});
    },

    dismissToast: (id) => {
        const current = get().toast;
        if (!id || !current || current.id === id) set({toast: null});
    },

    setSelected: (selected) => set({selected}),

    openBubble: (x, y) => set({bubble: {x, y}}),
    closeBubble: () => set({bubble: null}),

    openMemoForSelected: () => {
        const {selected, showToast} = get();
        if (!selected) {
            showToast("메모할 대상을 다시 오른쪽 클릭해주세요.");
            return;
        }

        const targets: Partial<Record<MemoType, string>> = {};
        if (selected.nick) targets.NICK = selected.nick;
        if (selected.uid) targets.UID = selected.uid;
        if (selected.ip) targets.IP = selected.ip;

        set({bubble: null, memo: {targets, initialType: selected.uid ? "UID" : selected.ip ? "IP" : "NICK"}});
    },

    closeMemo: () => set({memo: null})
}));
