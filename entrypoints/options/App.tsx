import {Box, Button, Flex, Grid, Heading, Separator, Text} from "@radix-ui/themes";
import {Ban, CircleHelp, Code, Database, Heart, Keyboard, type LucideIcon, MessageCircle, NotebookPen, Settings, Users} from "lucide-react";
import {useEffect, useState} from "react";

import {initBlocksStore} from "@/stores/blocks";
import {initMemosStore} from "@/stores/memos";
import {initModulesStore} from "@/stores/modules";

import {BlockTab} from "./BlockTab";
import {DataTab} from "./DataTab";
import {GeneralTab} from "./GeneralTab";
import {MemoTab} from "./MemoTab";
import {ShortcutTab} from "./ShortcutTab";

const TABS: { id: string; label: string; icon: LucideIcon; content: () => React.ReactNode }[] = [
    {id: "general", label: "설정", icon: Settings, content: () => <GeneralTab/>},
    {id: "block", label: "차단", icon: Ban, content: () => <BlockTab/>},
    {id: "memo", label: "메모", icon: NotebookPen, content: () => <MemoTab/>},
    {id: "shortcut", label: "단축키", icon: Keyboard, content: () => <ShortcutTab/>},
    {id: "data", label: "데이터", icon: Database, content: () => <DataTab/>}
];

const LINKS: [string, string, LucideIcon][] = [
    ["GitHub", "https://github.com/green1052/DCRefresher-Reborn", Code],
    ["갤러리", "https://gall.dcinside.com/mini/board/lists/?id=bjwg64", Users],
    ["Discord", "https://discord.gg/SSW6Zuyjz6", MessageCircle],
    ["도움말", "https://dcrefresher.green1052.com", CircleHelp],
    ["후원", "https://www.buymeacoffee.com/green1052", Heart]
];

// 로고: 원본 assets/icon.png(186KB)를 번들하지 않고, auto-icons가 만든 128px 아이콘(9KB)을 쓴다
const LOGO_URL = browser.runtime.getURL("/icons/128.png");

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
            <img src={LOGO_URL} alt="" width={36} height={36} style={{borderRadius: "var(--radius-3)"}}/>
            <Heading size="3">DCRefresher Reborn</Heading>
        </Flex>

        <Flex asChild direction={{initial: "row", md: "column"}} gap="1" wrap={{initial: "wrap", md: "nowrap"}}>
            <nav>
                {TABS.map(({id, label, icon: Icon}) => (
                    <Button
                        key={id}
                        size="3"
                        // soft/ghost는 Radix에서 패딩·높이가 달라 탭 전환시 흔들림 — ghost로 통일하고 배경만 바꾼다
                        variant="ghost"
                        color={tab === id ? undefined : "gray"}
                        highContrast={tab !== id}
                        aria-current={tab === id ? "page" : undefined}
                        style={{
                            justifyContent: "flex-start",
                            margin: 0,
                            background: tab === id ? "var(--accent-a4)" : undefined
                        }}
                        onClick={() => onSelect(id)}
                    >
                        <Icon size={16}/> {label}
                    </Button>
                ))}
            </nav>
        </Flex>

        <Box display={{initial: "none", md: "block"}} mt="auto">
            <Separator size="4" mb="3"/>
            <Grid columns="2" gap="1">
                {LINKS.map(([text, url, Icon]) => (
                    <Button key={url} asChild size="2" variant="ghost" color="gray"
                            style={{justifyContent: "flex-start", margin: 0}}>
                        <a href={url} target="_blank" rel="noreferrer">
                            <Icon size={14}/> {text}
                        </a>
                    </Button>
                ))}
            </Grid>
            <Text as="p" size="1" color="gray" mt="2" style={{paddingInline: "var(--space-2)"}}>v{VERSION}</Text>
        </Box>
    </Flex>
);

export function App() {
    const [tab, setTab] = useHashTab();
    const current = TABS.find((item) => item.id === tab)!;

    useEffect(() => {
        void initBlocksStore();
        void initMemosStore();
        void initModulesStore();
    }, []);


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
