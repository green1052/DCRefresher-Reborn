import {create} from "zustand";

import type {IpCategory} from "@/core/database";
import type {MemoType} from "@/core/storage/types";

export type ToastLevel = "info" | "error" | "warning";

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
    /** 글댓비 캐시와 경고 기준 (userinfo) — 글댓비 표시를 끄거나 모듈이 꺼져 있으면 null */
    ratios: { cache: Record<string, { article: number; comment: number }>; alarm: number } | null;

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
    ratios: null,

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
