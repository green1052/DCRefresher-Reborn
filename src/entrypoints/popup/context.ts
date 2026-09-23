import {createContext, useContext} from "react";

import type {useBlocks} from "./hooks/useBlocks";
import type {useData} from "./hooks/useData";
import type {useMemos} from "./hooks/useMemos";
import type {useSettings} from "./hooks/useSettings";

export interface AppContextValue {
    blocks: ReturnType<typeof useBlocks>;
    memos: ReturnType<typeof useMemos>;
    settings: ReturnType<typeof useSettings>;
    data: ReturnType<typeof useData>;
    // 일반 탭에서 모듈을 골랐을 때 모듈 탭의 해당 카드를 잠깐 강조한다.
    highlightModule: string | null;
    dismissHighlightModule: () => void;
    moveToModuleTab: (moduleName: string) => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export const useAppContext = (): AppContextValue => {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error("AppContext is not provided.");
    return ctx;
};
