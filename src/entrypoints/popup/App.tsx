import {useEffect, useState} from "react";
import {Tabs} from "radix-ui";
import {Ban, Database, ExternalLink, Keyboard, Package, Settings, StickyNote} from "lucide-react";

import iconUrl from "@/assets/icon.png";
import {AppContext, type AppContextValue} from "./context";
import {useBlocks} from "./hooks/useBlocks";
import {useData} from "./hooks/useData";
import {useMemos} from "./hooks/useMemos";
import {useSettings} from "./hooks/useSettings";
import BlockAddDialog from "../options/components/BlockAddDialog";
import UiService from "../options/components/UiService";
import BlockTab from "../options/tabs/BlockTab";
import DataTab from "../options/tabs/DataTab";
import GeneralTab from "../options/tabs/GeneralTab";
import MemoTab from "../options/tabs/MemoTab";
import ModuleTab from "../options/tabs/ModuleTab";
import ShortcutTab from "../options/tabs/ShortcutTab";

import "../options/options.scss";
import "./popup.scss";

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

const NAV = [
    {value: "general", label: "일반", icon: Settings},
    {value: "block", label: "차단", icon: Ban},
    {value: "memo", label: "메모", icon: StickyNote},
    {value: "module", label: "모듈", icon: Package},
    {value: "shortcut", label: "단축키", icon: Keyboard},
    {value: "data", label: "데이터", icon: Database}
];

export default function App() {
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

    const version = import.meta.env.DEV
        ? `${browser.runtime.getManifest().version}-dev`
        : browser.runtime.getManifest().version;

    return (
        <AppContext.Provider value={ctx}>
            <BlockAddDialog/>
            <UiService/>

            <div className="popup-shell">
                <header className="popup-header">
                    <img className="popup-header-icon" src={iconUrl}/>
                    <span className="popup-title">DCRefresher Reborn</span>
                    <span className="popup-version">v{version}</span>
                    <button
                        className="icon-btn"
                        onClick={() => void browser.runtime.openOptionsPage()}
                        style={{marginLeft: "auto"}}
                        title="전체 설정 페이지 열기"
                    >
                        <ExternalLink size={14}/>
                    </button>
                </header>

                <Tabs.Root className="popup-main" onValueChange={setTab} orientation="vertical" value={tab}>
                    <Tabs.List aria-label="설정 메뉴" className="popup-nav">
                        {NAV.map(({value, label, icon: Icon}) => (
                            <Tabs.Trigger className="popup-nav-item" key={value} value={value}>
                                <Icon size={15}/>
                                {label}
                            </Tabs.Trigger>
                        ))}
                    </Tabs.List>

                    <div className="popup-body">
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
            </div>
        </AppContext.Provider>
    );
}
