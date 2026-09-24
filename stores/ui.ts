import {create} from "zustand";

import type {MemoType} from "@/core/storage/types";

export type ToastLevel = "info" | "error" | "warning" | "cake";

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
    at: number;
}

export interface MemoTargetState {
    targets: Partial<Record<MemoType, string>>;
    initialType: MemoType;
}

interface UiState {
    toast: ToastData | null;
    selected: SelectedUser | null;
    memo: MemoTargetState | null;

    showToast: (content: string, type?: ToastLevel, autoClose?: number, onClick?: () => void) => void;
    dismissToast: (id?: number) => void;
    setSelected: (user: Omit<SelectedUser, "at">) => void;
    /** 마지막 선택(10초) 대상으로 메모 다이얼로그. 만료시 토스트 */
    openMemoForSelected: () => void;
    openMemo: (targets: Partial<Record<MemoType, string>>, initialType: MemoType) => void;
    closeMemo: () => void;
}

const SELECTION_TIMEOUT = 10_000;

let toastSeq = 0;

export const useUiStore = create<UiState>((set, get) => ({
    toast: null,
    selected: null,
    memo: null,

    showToast: (content, type = "info", autoClose = 5000, onClick) => {
        set({toast: {id: ++toastSeq, content, type, autoClose, onClick}});
    },

    dismissToast: (id) => {
        const current = get().toast;
        if (!id || !current || current.id === id) set({toast: null});
    },

    setSelected: (user) => {
        set({selected: {...user, at: Date.now()}});
    },

    openMemoForSelected: () => {
        const {selected, showToast} = get();
        if (!selected || Date.now() - selected.at > SELECTION_TIMEOUT) {
            showToast("차단할 대상을 다시 오른쪽 클릭해주세요.");
            return;
        }

        const targets: Partial<Record<MemoType, string>> = {};
        if (selected.nick) targets.NICK = selected.nick;
        if (selected.uid) targets.UID = selected.uid;
        if (selected.ip) targets.IP = selected.ip;

        set({memo: {targets, initialType: selected.uid ? "UID" : selected.ip ? "IP" : "NICK"}});
    },

    openMemo: (targets, initialType) => {
        set({memo: {targets, initialType}});
    },

    closeMemo: () => set({memo: null})
}));
