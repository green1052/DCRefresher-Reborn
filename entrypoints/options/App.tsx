import {Box, Button, Flex, Heading, Link, Separator, Text} from "@radix-ui/themes";
import {Ban, Database, Keyboard, type LucideIcon, NotebookPen, Puzzle, Settings} from "lucide-react";
import {useEffect, useState} from "react";

import logoUrl from "@/assets/icon.png";
import {sendMessage} from "@/core/messaging/protocol";
import {initBlocksStore} from "@/stores/blocks";
import {initMemosStore} from "@/stores/memos";
import {useModulesStore} from "@/stores/modules";

import {BlockTab} from "./BlockTab";
import {DataTab} from "./DataTab";
import {GeneralTab} from "./GeneralTab";
import {MemoTab} from "./MemoTab";
import {ModuleTab} from "./ModuleTab";
import {ShortcutTab} from "./ShortcutTab";

const TABS: { id: string; label: string; icon: LucideIcon; content: () => React.ReactNode }[] = [
    {id: "general", label: "일반", icon: Settings, content: () => <GeneralTab/>},
    {id: "block", label: "차단", icon: Ban, content: () => <BlockTab/>},
    {id: "memo", label: "메모", icon: NotebookPen, content: () => <MemoTab/>},
    {id: "module", label: "모듈", icon: Puzzle, content: () => <ModuleTab/>},
    {id: "shortcut", label: "단축키", icon: Keyboard, content: () => <ShortcutTab/>},
    {id: "data", label: "데이터", icon: Database, content: () => <DataTab/>}
];

const LINKS: [string, string][] = [
    ["GitHub", "https://github.com/green1052/DCRefresher-Reborn"],
    ["갤러리", "https://gall.dcinside.com/mini/board/lists/?id=bjwg64"],
    ["Discord", "https://discord.gg/SSW6Zuyjz6"],
    ["후원", "https://www.buymeacoffee.com/green1052"],
    ["도움말", "https://dcrefresher.green1052.com"]
];

const VERSION = browser.runtime.getManifest().version + (import.meta.env.DEV ? "-dev" : "");

/** 현재 탭은 location.hash에 둔다 — 새로고침/링크 공유시 유지 */
const readHash = (): string => {
    const id = location.hash.slice(1);
    return TABS.some((tab) => tab.id === id) ? id : TABS[0]!.id;
};

const useHashTab = (): [string, (id: string) => void] => {
    const [tab, setTab] = useState(readHash);

    useEffect(() => {
        const onHashChange = (): void => setTab(readHash());
        window.addEventListener("hashchange", onHashChange);
        return () => window.removeEventListener("hashchange", onHashChange);
    }, []);

    return [tab, (id) => (location.hash = id)];
};

/** 열린 디시인사이드 탭에서 모듈 스키마를 받아온다 */
const useModuleSchemas = (): void => {
    const setSchemas = useModulesStore((state) => state.setSchemas);
    const setUnavailable = useModulesStore((state) => state.setUnavailable);

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
};

const Sidebar = ({tab, onSelect}: { tab: string; onSelect: (id: string) => void }) => (
    <Flex
        direction="column"
        gap="4"
        p="4"
        width={{initial: "100%", md: "240px"}}
        flexShrink="0"
        position={{initial: "static", md: "sticky"}}
        top="0"
        height={{md: "100vh"}}
        style={{borderRight: "1px solid var(--gray-a5)"}}
    >
        <Flex align="center" gap="3" px="2">
            <img src={logoUrl} alt="" width={36} height={36} style={{borderRadius: "var(--radius-3)"}}/>
            <Box>
                <Heading size="3">DCRefresher Reborn</Heading>
                <Text size="1" color="gray">v{VERSION}</Text>
            </Box>
        </Flex>

        <Flex asChild direction={{initial: "row", md: "column"}} gap="1" wrap={{initial: "wrap", md: "nowrap"}}>
            <nav>
                {TABS.map(({id, label, icon: Icon}) => (
                    <Button
                        key={id}
                        size="3"
                        variant={tab === id ? "soft" : "ghost"}
                        color={tab === id ? undefined : "gray"}
                        highContrast={tab !== id}
                        aria-current={tab === id ? "page" : undefined}
                        style={{justifyContent: "flex-start", margin: 0}}
                        onClick={() => onSelect(id)}
                    >
                        <Icon size={16}/> {label}
                    </Button>
                ))}
            </nav>
        </Flex>

        <Box display={{initial: "none", md: "block"}} mt="auto">
            <Separator size="4" mb="3"/>
            <Flex gap="3" wrap="wrap" px="2">
                {LINKS.map(([text, url]) => (
                    <Link key={url} href={url} target="_blank" rel="noreferrer" size="1" color="gray">
                        {text}
                    </Link>
                ))}
            </Flex>
        </Box>
    </Flex>
);

export function App() {
    const [tab, setTab] = useHashTab();
    const current = TABS.find((item) => item.id === tab)!;

    useEffect(() => {
        void initBlocksStore();
        void initMemosStore();
    }, []);

    useModuleSchemas();

    return (
        <Flex direction={{initial: "column", md: "row"}} minHeight="100vh">
            <Sidebar tab={tab} onSelect={setTab}/>

            <Box flexGrow="1" minWidth="0" px={{initial: "4", md: "6"}} py="6">
                <Box maxWidth="880px" mx="auto">
                    <Heading size="7" mb="5">{current.label}</Heading>
                    {current.content()}
                </Box>
            </Box>
        </Flex>
    );
}
