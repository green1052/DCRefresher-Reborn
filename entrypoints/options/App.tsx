import {Box, Tabs} from "@radix-ui/themes";
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

const TABS: { id: string; label: string; content: React.ReactNode }[] = [
    {id: "general", label: "일반", content: <GeneralTab/>},
    {id: "block", label: "차단", content: <BlockTab/>},
    {id: "memo", label: "메모", content: <MemoTab/>},
    {id: "module", label: "모듈", content: <ModuleTab/>},
    {id: "shortcut", label: "단축키", content: <ShortcutTab/>},
    {id: "data", label: "데이터", content: <DataTab/>}
];

export function App() {
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

        const onUpdated = (tabId: number, changeInfo: { status?: string }, tab: { url?: string }): void => {
            if (changeInfo.status === "complete" && tab.url?.includes("dcinside.com")) void detect();
        };

        browser.tabs.onUpdated.addListener(onUpdated);
        return () => browser.tabs.onUpdated.removeListener(onUpdated);
    }, [setSchemas, setUnavailable]);

    return (
        <Tabs.Root defaultValue="general" style={{display: "flex", flex: 1, minHeight: "100vh"}}>
            <Box style={{
                flex: "none",
                padding: 16,
                alignSelf: "flex-start",
                position: "sticky",
                top: 0,
                height: "100%"
            }}>
                <Tabs.List
                    style={{
                        flexDirection: "column",
                        alignItems: "stretch",
                        width: 200,
                        gap: 4,
                        padding: 8,
                        backgroundColor: "var(--gray-a3)",
                        borderRadius: 12
                    }}
                >
                    {TABS.map((tab) => (
                        <Tabs.Trigger key={tab.id} value={tab.id}
                                      style={{justifyContent: "flex-start", borderRadius: 8, padding: "8px 14px"}}>
                            {tab.label}
                        </Tabs.Trigger>
                    ))}
                </Tabs.List>
            </Box>

            <Box style={{flex: 1, minWidth: 0, padding: "24px 32px 48px"}}>
                {TABS.map((tab) => (
                    <Tabs.Content key={tab.id} value={tab.id} style={{paddingTop: 0}}>
                        {tab.content}
                    </Tabs.Content>
                ))}
            </Box>
        </Tabs.Root>
    );
}
