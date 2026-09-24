import {create} from "zustand";

export type ToastLevel = "info" | "error" | "warning" | "cake";

export interface ToastData {
    id: number;
    content: string;
    type: ToastLevel;
    autoClose: number;
    onClick?: () => void;
}

interface UiState {
    toast: ToastData | null;

    showToast: (content: string, type?: ToastLevel, autoClose?: number, onClick?: () => void) => void;
    dismissToast: (id?: number) => void;
}

let toastSeq = 0;

export const useUiStore = create<UiState>((set, get) => ({
    toast: null,

    showToast: (content, type = "info", autoClose = 5000, onClick) => {
        set({toast: {id: ++toastSeq, content, type, autoClose, onClick}});
    },

    dismissToast: (id) => {
        const current = get().toast;
        if (!id || !current || current.id === id) set({toast: null});
    }
}));
