import {useEffect, useState} from "react";
import * as Tabs from "@radix-ui/react-tabs";
import {ExternalLink} from "lucide-react";

import {AppContext, type AppContextValue} from "../popup/context";
import {useBlocks} from "../popup/hooks/useBlocks";
import {useData} from "../popup/hooks/useData";
import {useMemos} from "../popup/hooks/useMemos";
import {useSettings} from "../popup/hooks/useSettings";
import BlockAddDialog from "./components/BlockAddDialog";
import UiService from "./components/UiService";
import BlockTab from "./tabs/BlockTab";
import DataTab from "./tabs/DataTab";
import GeneralTab from "./tabs/GeneralTab";
import MemoTab from "./tabs/MemoTab";
import ModuleTab from "./tabs/ModuleTab";
import ShortcutTab from "./tabs/ShortcutTab";

import "./options.scss";

const useSystemAppearance = (): "light" | "dark" => {
    const [dark, setDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);

    useEffect(() => {
        const mq = window.matchMedia("(prefers-color-scheme: dark)");
        const apply = () => setDark(mq.matches);
        mq.addEventListener("change", apply);
        return () => mq.removeEventListener("change", apply);
    }, []);

    return dark ? "dark" : "light";
};

// embedded=true면 브라우저 액션 팝업(고정폭)으로, 아니면 전체 옵션 페이지로 렌더한다.
export default function App({embedded = false}: {embedded?: boolean}) {
    const appearance = useSystemAppearance();
    const [tab, setTab] = useState("general");
    const [highlightModule, setHighlightModule] = useState<string | null>(null);

    useEffect(() => {
        document.documentElement.dataset.theme = appearance;
    }, [appearance]);

    const blocks = useBlocks();
    const memos = useMemos();
    const settings = useSettings();
    const data = useData();

    // 일반 탭의 모듈 헤더를 누르면 모듈 탭으로 이동해 해당 카드를 잠깐 강조한다.
    const moveToModuleTab = (moduleName: string) => {
        setTab("module");
        setHighlightModule(moduleName);
    };

    const ctx: AppContextValue = {
        blocks,
        memos,
        settings,
        data,
        highlightModule,
        dismissHighlightModule: () => setHighlightModule(null),
        moveToModuleTab
    };

    const content = (
        <AppContext.Provider value={ctx}>
            <BlockAddDialog/>
            <UiService/>

            <Tabs.Root
                onValueChange={setTab}
                style={{display: "flex", flexDirection: "column", flexGrow: embedded ? 1 : 0, minHeight: 0}}
                value={tab}
            >
                <div className="row" style={{justifyContent: "space-between", marginBottom: 8}}>
                    <Tabs.List className="tabs-list">
                        <Tabs.Trigger className="tabs-trigger" value="general">일반</Tabs.Trigger>
                        <Tabs.Trigger className="tabs-trigger" value="block">차단</Tabs.Trigger>
                        <Tabs.Trigger className="tabs-trigger" value="memo">메모</Tabs.Trigger>
                        <Tabs.Trigger className="tabs-trigger" value="module">모듈</Tabs.Trigger>
                        <Tabs.Trigger className="tabs-trigger" value="shortcut">단축키</Tabs.Trigger>
                        <Tabs.Trigger className="tabs-trigger" value="data">데이터</Tabs.Trigger>
                    </Tabs.List>

                    {embedded && (
                        <button
                            className="icon-btn"
                            onClick={() => void browser.runtime.openOptionsPage()}
                            title="전체 설정 페이지 열기"
                        >
                            <ExternalLink size={14}/>
                        </button>
                    )}
                </div>

                <div className={embedded ? "grow" : undefined}>
                    <Tabs.Content value="general">
                        <GeneralTab/>
                    </Tabs.Content>
                    <Tabs.Content value="block">
                        <BlockTab/>
                    </Tabs.Content>
                    <Tabs.Content value="memo">
                        <MemoTab/>
                    </Tabs.Content>
                    <Tabs.Content value="module">
                        <ModuleTab/>
                    </Tabs.Content>
                    <Tabs.Content value="shortcut">
                        <ShortcutTab/>
                    </Tabs.Content>
                    <Tabs.Content value="data">
                        <DataTab/>
                    </Tabs.Content>
                </div>
            </Tabs.Root>
        </AppContext.Provider>
    );

    return embedded ? <div className="app-embedded">{content}</div> : <div className="app-page">{content}</div>;
}
