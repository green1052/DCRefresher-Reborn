import {ExternalLink} from "lucide-react";
import {useState} from "react";

import BlockDialog from "./components/BlockDialog";
import {AppContext, type AppContextValue} from "./context";
import {useBlocks} from "./hooks/useBlocks";
import {useData} from "./hooks/useData";
import {useMemos} from "./hooks/useMemos";
import {useSettings} from "./hooks/useSettings";
import BlockTab from "./tabs/BlockTab";
import DataTab from "./tabs/DataTab";
import GeneralTab from "./tabs/GeneralTab";
import MemoTab from "./tabs/MemoTab";
import ModuleTab from "./tabs/ModuleTab";
import ShortcutTab from "./tabs/ShortcutTab";

import "./popup.scss";

const tabs = [
    {id: 0, label: "일반"},
    {id: 1, label: "차단"},
    {id: 2, label: "메모"},
    {id: 3, label: "모듈"},
    {id: 4, label: "단축키"},
    {id: 5, label: "데이터"}
] as const;

export default function App({optionsPage}: { optionsPage?: boolean }) {
    const [tab, setTab] = useState(0);

    const blocksComposable = useBlocks();
    const memosComposable = useMemos();
    const settingsComposable = useSettings();
    const dataComposable = useData();

    const moveToModuleTab = (moduleName: string) => {
        setTab(3);
        settingsComposable.moveToModuleTab(moduleName);
    };

    const ctx: AppContextValue = {
        blocks: blocksComposable,
        memos: memosComposable,
        settings: settingsComposable,
        data: dataComposable,
        moveToModuleTab
    };

    const openOptions = () => {
        browser.runtime.openOptionsPage();
    };

    return (
        <AppContext.Provider value={ctx}>
            <div className={optionsPage ? "refresher-app options-page" : "refresher-app"} id="refresher-app">
                <BlockDialog
                    blockDetectModeTypeNames={blocksComposable.blockDetectModeTypeNames}
                    blockKeyNames={blocksComposable.blockKeyNames}
                    currentBlockType={blocksComposable.currentBlockType}
                    formData={blocksComposable.blockFormData}
                    onChange={blocksComposable.updateBlockForm}
                    onClose={blocksComposable.closeBlockDialog}
                    onConfirm={() => void blocksComposable.confirmAddBlock()}
                    visible={blocksComposable.showBlockDialog}
                />

                <div className="refresher-title-zone">
                    <h1>설정</h1>
                    <div className="float-right">
                        {tabs.map((tabItem) => (
                            <p
                                className={tab === tabItem.id ? "active" : undefined}
                                key={tabItem.id}
                                onClick={() => setTab(tabItem.id)}
                            >
                                {tabItem.label}
                            </p>
                        ))}
                    </div>
                    {!optionsPage && (
                        <button
                            className="open-options-btn"
                            onClick={openOptions}
                            title="전체 설정 페이지 열기"
                        >
                            <ExternalLink size={14}/>
                        </button>
                    )}
                </div>

                {tab === 0 && <GeneralTab key="tab1"/>}
                {tab === 1 && <BlockTab key="tab2"/>}
                {tab === 2 && <MemoTab key="tab3"/>}
                {tab === 3 && <ModuleTab key="tab4"/>}
                {tab === 4 && <ShortcutTab key="tab5"/>}
                {tab === 5 && <DataTab key="tab6"/>}
            </div>
        </AppContext.Provider>
    );
}
