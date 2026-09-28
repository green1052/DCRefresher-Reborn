import {create} from "zustand";

const DEV_MODE_KEY = "refresher:devMode";
const DEV_MODE_CLICKS = 5;

const readDevMode = (): boolean => {
    try {
        return localStorage.getItem(DEV_MODE_KEY) === "1";
    } catch {
        return false;
    }
};

const writeDevMode = (on: boolean): void => {
    try {
        if (on) localStorage.setItem(DEV_MODE_KEY, "1");
        else localStorage.removeItem(DEV_MODE_KEY);
    } catch {
        // 저장이 막혀 있으면 이번 세션에만 유지
    }
};

interface OptionsState {
    /**
     * 개발자 탭 표시 여부. 개발 빌드이거나 정보 탭의 버전을 5번 연달아 누르면 켜진다.
     * 설정 백업에 섞이지 않게 옵션 페이지 localStorage에 기억한다.
     */
    devMode: boolean;
    /** 디시콘 비(로고 이스터에그). 누를 때마다 새 값(Date.now())이 들어가 비를 다시 마운트한다. 0이면 없다 */
    rain: number;
    /** 확인 버튼만 있는 알림. App이 하나만 그린다. null이면 닫혀 있다 */
    notice: string | null;
    /** ev.detail: 브라우저가 세는 연속 클릭 횟수 (간격이 벌어지면 1부터) */
    unlockDev: (ev: { detail: number }) => void;
    hideDev: () => void;
    startRain: () => void;
    endRain: () => void;
}

/** 옵션 페이지 화면 상태. 사이드바와 탭들이 props를 거치지 않고 같이 쓴다 */
export const useOptionsStore = create<OptionsState>()((set, get) => ({
    devMode: import.meta.env.DEV || readDevMode(),
    rain: 0,
    notice: null,

    unlockDev: (ev) => {
        if (ev.detail < DEV_MODE_CLICKS || get().devMode) return;

        writeDevMode(true);
        set({devMode: true});
        location.hash = "dev";
    },

    hideDev: () => {
        writeDevMode(false);
        set({devMode: import.meta.env.DEV});
        location.hash = "";
    },

    // 동작 줄이기(prefers-reduced-motion)를 켰으면 비를 내리지 않는다
    startRain: () => {
        if (!matchMedia("(prefers-reduced-motion: reduce)").matches) set({rain: Date.now()});
    },
    endRain: () => set({rain: 0})
}));

/** 옵션 페이지 알림을 띄운다. 탭마다 알림 상태를 따로 두지 않고 이것을 쓴다 */
export const notify = (message: string): void => useOptionsStore.setState({notice: message});
