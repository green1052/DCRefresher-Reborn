import {create} from "zustand";

interface OptionsState {
    /** 디시콘 비(로고 이스터에그). 누를 때마다 새 값(Date.now())이 들어가 비를 다시 마운트한다. 0이면 없다. */
    rain: number;
    /** 확인 버튼만 있는 알림. App이 하나만 그린다. null이면 닫혀 있다. */
    notice: string | null;
    startRain: () => void;
    endRain: () => void;
}

/** 옵션 페이지 화면 상태. 사이드바와 탭들이 props를 거치지 않고 같이 쓴다. */
export const useOptionsStore = create<OptionsState>()((set) => ({
    rain: 0,
    notice: null,

    // 동작 줄이기(prefers-reduced-motion)를 켰으면 비를 내리지 않는다.
    startRain: () => {
        if (!matchMedia("(prefers-reduced-motion: reduce)").matches) set({rain: Date.now()});
    },
    endRain: () => set({rain: 0})
}));

/** 옵션 페이지 알림을 띄운다. 탭마다 알림 상태를 따로 두지 않고 이것을 쓴다. */
export const notify = (message: string): void => useOptionsStore.setState({notice: message});
