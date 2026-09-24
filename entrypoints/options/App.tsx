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
        const detect = async (): Promise<void> => {
            const tabs = await browser.tabs.query({url: "*://*.dcinside.com/*"});

            for (const tab of tabs) {
                if (!tab.id) continue;

                try {
                    const schemas = await sendMessage("refresher:getModuleSchema", undefined, {tabId: tab.id});
                    useModulesStore.setState({tabId: tab.id, unavailable: false});
                    setSchemas(schemas);
                    return;
                } catch {
                    // 이 탭의 콘텐츠 스크립트 무응답 (확장 리로드 직후 등) — 다음 탭 시도
                }
            }

            setUnavailable(true);
        };

        void detect();

        // DC 탭 새로고침/이동 시 자동 재시도
        const onUpdated = (tabId: number, changeInfo: {status?: string}, tab: {url?: string}): void => {
            if (changeInfo.status === "complete" && tab.url?.includes("dcinside.com")) void detect();
        };

        browser.tabs.onUpdated.addListener(onUpdated);
        return () => browser.tabs.onUpdated.removeListener(onUpdated);
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

            <Tabs.Root defaultValue="general" className="refresher-tabs">
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
