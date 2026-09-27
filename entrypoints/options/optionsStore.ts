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
    /** 개발자 탭: 개발 빌드이거나, 정보 탭의 버전을 5번 연달아 누르면 열린다 (옵션 페이지 localStorage에 기억 — 설정 백업에 섞이지 않게) */
    devMode: boolean;
    /** 디시콘 비 (로고 이스터에그) — 누를 때마다 새 값이라 비를 새로 마운트한다 (0이면 없음) */
    rain: number;
    /** ev.detail: 브라우저가 세는 연속 클릭 횟수 (간격이 벌어지면 1부터) */
    unlockDev: (ev: { detail: number }) => void;
    hideDev: () => void;
    startRain: () => void;
    endRain: () => void;
}

/** 옵션 페이지 화면 상태 — 사이드바·정보 탭·개발자 탭이 props로 넘기지 않고 같이 쓴다 */
export const useOptionsStore = create<OptionsState>()((set, get) => ({
    devMode: import.meta.env.DEV || readDevMode(),
    rain: 0,

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

    startRain: () => set({rain: Date.now()}),
    endRain: () => set({rain: 0})
}));
