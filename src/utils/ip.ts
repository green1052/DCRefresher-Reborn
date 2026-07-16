import type {Nullable} from "./types";

import eventBus from "@/core/eventbus";

let ipData: Record<string, string> = {};

// 외부에서 IP 데이터 주입 (결합 분리: databaseStorage 직접 의존 제거)
export const setIpData = (data: Record<string, string>): void => {
    ipData = data;
};

// eventBus를 통해 IP 데이터 수신 (content script 컨텍스트)
// data 모듈이 databaseStorage.ip에서 로드 후 refresherModuleConfig 이벤트로 게시
eventBus.on("refresherModuleConfig", (module, config) => {
    if (module === "database" && config.ip && typeof config.ip === "object") {
        setIpData(config.ip as Record<string, string>);
    }
});

export const ISPData = (ip: string): ISPInfo => {
    if (!Object.keys(ipData).length) return {name: undefined, color: "#6495ed"};

    return {
        name: ipData?.[ip],
        color: "#6495ed"
    };
};

export const format = (data: ISPInfo): Nullable<string> => {
    const {name} = data;
    return name ?? null;
};

// 더 이상 비동기 초기화가 필요 없음 (데이터는 eventBus로 수신)
export const ensureIpDataReady = (): Promise<void> => Promise.resolve();

export default {
    ISPData,
    format,
    ensureIpDataReady,
    setIpData
};