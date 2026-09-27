import {Box, Button, Flex, Heading, Separator, Text} from "@radix-ui/themes";
import {Ban, Database, Info, Keyboard, type LucideIcon, NotebookPen, Settings, Wrench} from "lucide-react";
import {useEffect, useState} from "react";

import {Notice} from "@/components/ConfirmDialog";
import {fontFamilyOf} from "@/features/fonts";
import {initBlocksStore} from "@/stores/blocks";
import {initMemosStore} from "@/stores/memos";
import {initModulesStore, useModulesStore} from "@/stores/modules";

import {AboutTab} from "./AboutTab";
import {BlockTab} from "./BlockTab";
import {DataTab} from "./DataTab";
import {DcconRain} from "./DcconRain";
import {DevTab} from "./DevTab";
import {GeneralTab} from "./GeneralTab";
import {MemoTab} from "./MemoTab";
import {useOptionsStore} from "./optionsStore";
import {ShortcutTab} from "./ShortcutTab";

interface TabDef {
    id: string;
    label: string;
    icon: LucideIcon;
    /** 개발자 모드에서만 보임 */
    dev?: boolean;
    content: () => React.ReactNode;
}

const TABS: TabDef[] = [
    {id: "general", label: "설정", icon: Settings, content: () => <GeneralTab/>},
    {id: "block", label: "차단", icon: Ban, content: () => <BlockTab/>},
    {id: "memo", label: "메모", icon: NotebookPen, content: () => <MemoTab/>},
    {id: "shortcut", label: "단축키", icon: Keyboard, content: () => <ShortcutTab/>},
    {id: "data", label: "데이터", icon: Database, content: () => <DataTab/>},
    {id: "about", label: "정보", icon: Info, content: () => <AboutTab logo={LOGO_URL} version={VERSION}/>},
    {id: "dev", label: "개발자", icon: Wrench, dev: true, content: () => <DevTab/>}
];

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

const Sidebar = ({tabs, tab, onSelect}: {
    tabs: TabDef[];
    tab: string;
    onSelect: (id: string) => void;
}) => (
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
            <img src={LOGO_URL} alt="" width={36} height={36} style={{borderRadius: "var(--radius-3)"}}
                 onClick={() => useOptionsStore.getState().startRain()}/>
            <Heading size="3">DCRefresher Reborn</Heading>
        </Flex>

        <Flex asChild direction={{initial: "row", md: "column"}} gap="1" wrap={{initial: "wrap", md: "nowrap"}}>
            <nav>
                {tabs.map(({id, label, icon: Icon}) => (
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
            <Text as="p" size="1" color="gray" style={{paddingInline: "var(--space-2)"}}>
                v{VERSION}
            </Text>
        </Box>
    </Flex>
);

export function App() {
    const [tab, setTab] = useHashTab();
    const devMode = useOptionsStore((state) => state.devMode);
    // 로고 클릭 — 디시콘 비 (이스터에그)
    const rain = useOptionsStore((state) => state.rain);
    const notice = useOptionsStore((state) => state.notice);
    const tabs = TABS.filter((item) => !item.dev || devMode);
    const current = tabs.find((item) => item.id === tab) ?? tabs[0]!;

    useEffect(() => {
        void initBlocksStore();
        void initMemosStore();
        void initModulesStore();
    }, []);

    // 폰트 교체 모듈 설정을 옵션 페이지에도 (options.scss가 --refresher-font를 쓴다)
    const fontsEnabled = useModulesStore((state) => state.enables.fonts);
    const customFonts = useModulesStore((state) => state.values.fonts?.customFonts);
    useEffect(() => {
        const root = document.documentElement.style;
        if (fontsEnabled) root.setProperty("--refresher-font", fontFamilyOf(String(customFonts ?? "")));
        else root.removeProperty("--refresher-font");
    }, [fontsEnabled, customFonts]);

    return (
        <Flex direction={{initial: "column", md: "row"}} minHeight="100vh">
            <Sidebar tabs={tabs} tab={current.id} onSelect={setTab}/>
            {/* 누를 때마다 새로 마운트 — React Compiler가 Math.random으로 그린 결과를 기억해 같은 모양이 반복되지 않게 */}
            {rain > 0 && <DcconRain key={rain}/>}
            <Notice message={notice} onClose={() => useOptionsStore.setState({notice: null})}/>

            <Box flexGrow="1" minWidth="0" px={{initial: "4", md: "6"}} py="6">
                <Box maxWidth="880px" mx="auto">
                    <Heading size="7" mb="5">{current.label}</Heading>
                    {current.content()}
                </Box>
            </Box>
        </Flex>
    );
}
