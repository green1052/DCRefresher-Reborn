import {ExternalLink} from "lucide-react";
import {Tabs} from "radix-ui";
import {useEffect} from "react";

import {BlockTab} from "./BlockTab";
import {DataTab} from "./DataTab";
import {GeneralTab} from "./GeneralTab";
import {MemoTab} from "./MemoTab";
import {ModuleTab} from "./ModuleTab";
import {ShortcutTab} from "./ShortcutTab";
import {sendMessage} from "@/core/messaging/protocol";
import {initBlocksStore} from "@/stores/blocks";
import {initMemosStore} from "@/stores/memos";
import {useModulesStore} from "@/stores/modules";

const TABS: {id: string; label: string; content: React.ReactNode}[] = [
    {id: "general", label: "일반", content: <GeneralTab />},
    {id: "block", label: "차단", content: <BlockTab />},
    {id: "memo", label: "메모", content: <MemoTab />},
    {id: "module", label: "모듈", content: <ModuleTab />},
    {id: "shortcut", label: "단축키", content: <ShortcutTab />},
    {id: "data", label: "데이터", content: <DataTab />}
];

export function App({optionsPage = false}: {optionsPage?: boolean}) {
    const setSchemas = useModulesStore((state) => state.setSchemas);
    const setUnavailable = useModulesStore((state) => state.setUnavailable);

    useEffect(() => {
        void initBlocksStore();
        void initMemosStore();
    }, []);

    useEffect(() => {
        void (async () => {
            const [tab] = await browser.tabs.query({active: true, currentWindow: true});
            if (!tab || !tab.id || !tab.url?.includes("dcinside.com")) {
                setUnavailable(true);
                return;
            }

            useModulesStore.setState({tabId: tab.id});

            try {
                setSchemas(await sendMessage("refresher:getModuleSchema", undefined, {tabId: tab.id}));
            } catch {
                setUnavailable(true);
            }
        })();
    }, [setSchemas, setUnavailable]);

    return (
        <div className={`refresher-app${optionsPage ? " refresher-options" : ""}`}>
            <header className="refresher-header">
                <h1>DCRefresher</h1>
                {!optionsPage && (
                    <button
                        className="refresher-open-options"
                        title="전체 설정 페이지 열기"
                        onClick={() => void browser.runtime.openOptionsPage()}
                    >
                        <ExternalLink size={14} />
                    </button>
                )}
            </header>

            <Tabs.Root defaultValue="general">
                <Tabs.List className="refresher-tabs-list">
                    {TABS.map((tab) => (
                        <Tabs.Trigger key={tab.id} value={tab.id} className="refresher-tab-trigger">
                            {tab.label}
                        </Tabs.Trigger>
                    ))}
                </Tabs.List>

                {TABS.map((tab) => (
                    <Tabs.Content key={tab.id} value={tab.id} className="refresher-tab-content">
                        {tab.content}
                    </Tabs.Content>
                ))}
            </Tabs.Root>
        </div>
    );
}
