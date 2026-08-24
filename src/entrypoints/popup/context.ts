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
    moveToModuleTab: (moduleName: string) => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export const useAppContext = (): AppContextValue => {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error("AppContext is not provided.");
    return ctx;
};
