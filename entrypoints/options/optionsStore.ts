import {create} from "@/utils/store";

import {useUiStore} from "@/stores/ui";

interface OptionsState {
    rain: number;
    notice: string | null;
    startRain: () => void;
    endRain: () => void;
}

/** 옵션 페이지 화면 상태. 사이드바와 탭들이 props를 거치지 않고 같이 쓴다. */
export const useOptionsStore = create<OptionsState>((set) => ({
    rain: 0,
    notice: null,

    startRain: () => {
        if (!matchMedia("(prefers-reduced-motion: reduce)").matches) set({rain: Date.now()});
    },
    endRain: () => set({rain: 0})
}));

/** 확인 알림(실패 등) - 탭마다 상태를 두지 않고 이것으로 띄운다. */
export const notify = (message: string): void => useOptionsStore.setState({notice: message});

export type Done = string | { message: string; undo: () => void };

export const notifyDone = (done: Done): void => {
    const {showToast} = useUiStore.getState();
    if (typeof done === "string") showToast(done);
    // 되돌리기가 달린 알림은 잘못 누른 것을 알아챌 시간을 넉넉히 둔다.
    else showToast(done.message, "info", 20_000, {label: "되돌리기", run: done.undo});
};
