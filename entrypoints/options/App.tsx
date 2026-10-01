import {Box, Button, Flex, Heading, Separator, Text} from "@radix-ui/themes";
import {Ban, Database, Info, Keyboard, type LucideIcon, NotebookPen, Settings, Wrench} from "lucide-react";
import {lazy, Suspense, useEffect, useState, useSyncExternalStore} from "react";

import {Notice} from "@/components/ConfirmDialog";
import {initBlocksStore} from "@/stores/blocks";
import {initMemosStore} from "@/stores/memos";
import {initModulesStore, useExtensionPageVars} from "@/stores/modules";

import {AboutTab} from "./AboutTab";
import {BlockTab} from "./BlockTab";
import {DataTab} from "./DataTab";
import {GeneralTab} from "./GeneralTab";
import {MemoTab} from "./MemoTab";
import {useOptionsStore} from "./optionsStore";
import {ShortcutTab} from "./ShortcutTab";

// 개발자 탭과 디시콘 비는 드물게 열리므로 옵션 페이지를 열 때 같이 불러오지 않는다(개발자 탭은 IP/밴 DB 원문도 읽는다)
const DevTab = lazy(() => import("./DevTab").then(({DevTab}) => ({default: DevTab})));
const DcconRain = lazy(() => import("./DcconRain").then(({DcconRain}) => ({default: DcconRain})));

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

/** 현재 탭은 location.hash에 둬서 새로고침하거나 링크를 공유해도 유지되게 한다 */
const readHash = (): string => {
    const id = location.hash.slice(1);
    return TABS.some((tab) => tab.id === id) ? id : TABS[0]!.id;
};

const subscribeHash = (onChange: () => void): (() => void) => {
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
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
            {/* h1은 본문의 탭 제목 하나만 둔다. 모양만 제목으로 그린다 */}
            <Heading asChild size="3"><p>DCRefresher Reborn</p></Heading>
        </Flex>

        <Flex asChild direction={{initial: "row", md: "column"}} gap="1" wrap={{initial: "wrap", md: "nowrap"}}>
            <nav>
                {tabs.map(({id, label, icon: Icon}) => (
                    <Button
                        key={id}
                        size="3"
                        // Radix의 soft와 ghost는 패딩·높이가 달라 탭을 바꿀 때 흔들린다. ghost로 통일하고 배경만 바꾼다
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
    const tab = useSyncExternalStore(subscribeHash, readHash);
    const devMode = useOptionsStore((state) => state.devMode);
    const rain = useOptionsStore((state) => state.rain);
    const notice = useOptionsStore((state) => state.notice);
    const tabs = TABS.filter((item) => !item.dev || devMode);
    const current = tabs.find((item) => item.id === tab) ?? tabs[0]!;
    const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");

    useEffect(() => {
        // 못 읽은 채 차단·메모를 고치면 빈 목록을 바탕으로 저장해 기존 목록을 덮으므로 탭을 그리지 않는다
        // 읽기 전에 그리면 빈 목록에서 고친 결과(전체 삭제·추가·가져오기)가 저장된 목록을 덮는다
        Promise.all([initBlocksStore(), initMemosStore(), initModulesStore()]).then(
            () => setStatus("ready"),
            (e) => {
                console.error(e);
                setStatus("failed");
            }
        );
    }, []);

    // 모듈이 선언한 확장 페이지 CSS 변수 (폰트 교체 등)
    useExtensionPageVars();

    return (
        <Flex direction={{initial: "column", md: "row"}} minHeight="100vh">
            <Sidebar tabs={tabs} tab={current.id} onSelect={(id) => (location.hash = id)}/>
            {/* 누를 때마다 새로 마운트한다. React Compiler가 Math.random으로 그린 결과를 기억해 같은 모양이 반복되기 때문이다 */}
            {rain > 0 && <Suspense><DcconRain key={rain}/></Suspense>}
            <Notice message={notice} onClose={() => useOptionsStore.setState({notice: null})}/>

            <Box flexGrow="1" minWidth="0" px={{initial: "4", md: "6"}} py="6">
                {/* 탭마다 새로 마운트해 들어오는 애니메이션을 다시 건다 (options.scss).
                    연 버튼이 막혀(데이터 초기화 중) 돌아갈 곳이 없으면 다이얼로그가 포커스를 이 탭으로 돌려준다 (useOpenerFocus) */}
                <Box key={current.id} className="refresher-tab-enter" maxWidth="880px" mx="auto" tabIndex={-1} style={{outline: "none"}}>
                    <Heading size="7" mb="5">{current.label}</Heading>
                    {status === "failed"
                        ? <Text as="p" color="red">저장된 데이터를 읽지 못했습니다. 페이지를 새로고침해 주세요.</Text>
                        : status === "ready" && <Suspense>{current.content()}</Suspense>}
                </Box>
            </Box>
        </Flex>
    );
}
