import {ExternalLink} from "lucide-react";
import {Tabs} from "radix-ui";
import {useEffect} from "react";

import {sendMessage} from "@/core/messaging/protocol";
import {useModulesStore} from "@/stores/modules";

import {DataTab} from "./DataTab";
import {ModuleTab} from "./ModuleTab";

const TABS: {id: string; label: string; content: React.ReactNode}[] = [
    {id: "general", label: "일반", content: <div className="empty">일반 설정 (M2)</div>},
    {id: "block", label: "차단", content: <div className="empty">차단 관리 (M2)</div>},
    {id: "memo", label: "메모", content: <div className="empty">메모 관리 (M2)</div>},
    {id: "module", label: "모듈", content: <ModuleTab />},
    {id: "shortcut", label: "단축키", content: <div className="empty">단축키 (M5)</div>},
    {id: "data", label: "데이터", content: <DataTab />}
];

export function App({optionsPage = false}: {optionsPage?: boolean}) {
    const setSchemas = useModulesStore((state) => state.setSchemas);
    const setUnavailable = useModulesStore((state) => state.setUnavailable);

    useEffect(() => {
        void (async () => {
            const [tab] = await browser.tabs.query({active: true, currentWindow: true});
            if (!tab || !tab.id || !tab.url?.includes("dcinside.com")) {
                setUnavailable(true);
                return;
            }

            try {
                setSchemas(await sendMessage("dcr:getModuleSchema", undefined, {tabId: tab.id}));
            } catch {
                setUnavailable(true);
            }
        })();
    }, [setSchemas, setUnavailable]);

    return (
        <div className={`dcr-app${optionsPage ? " dcr-options" : ""}`}>
            <header className="dcr-header">
                <h1>DCRefresher</h1>
                {!optionsPage && (
                    <button
                        className="dcr-open-options"
                        title="전체 설정 페이지 열기"
                        onClick={() => void browser.runtime.openOptionsPage()}
                    >
                        <ExternalLink size={14} />
                    </button>
                )}
            </header>

            <Tabs.Root defaultValue="general">
                <Tabs.List className="dcr-tabs-list">
                    {TABS.map((tab) => (
                        <Tabs.Trigger key={tab.id} value={tab.id} className="dcr-tab-trigger">
                            {tab.label}
                        </Tabs.Trigger>
                    ))}
                </Tabs.List>

                {TABS.map((tab) => (
                    <Tabs.Content key={tab.id} value={tab.id} className="dcr-tab-content">
                        {tab.content}
                    </Tabs.Content>
                ))}
            </Tabs.Root>
        </div>
    );
}
