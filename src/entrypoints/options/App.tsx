import {useEffect, useState} from "react";
import {Box, Container, Flex, IconButton, Theme, Tabs} from "@radix-ui/themes";
import {ExternalLink} from "lucide-react";

import {AppContext, type AppContextValue} from "../popup/context";
import {useBlocks} from "../popup/hooks/useBlocks";
import {useData} from "../popup/hooks/useData";
import {useMemos} from "../popup/hooks/useMemos";
import {useSettings} from "../popup/hooks/useSettings";
import BlockAddDialog from "./components/BlockAddDialog";
import UiService from "./components/UiService";
import BlockTab from "./tabs/BlockTab";
import DataTab from "./tabs/DataTab";
import GeneralTab from "./tabs/GeneralTab";
import MemoTab from "./tabs/MemoTab";
import ModuleTab from "./tabs/ModuleTab";
import ShortcutTab from "./tabs/ShortcutTab";

import "@radix-ui/themes/styles.css";
import "./options.scss";

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

// embedded=true면 브라우저 액션 팝업(고정폭)으로, 아니면 전체 옵션 페이지로 렌더한다.
export default function App({embedded = false}: {embedded?: boolean}) {
    const appearance = useSystemAppearance();
    const [tab, setTab] = useState("general");
    const [highlightModule, setHighlightModule] = useState<string | null>(null);

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

    const content = (
        <AppContext.Provider value={ctx}>
            <BlockAddDialog/>
            <UiService/>

            <Tabs.Root onValueChange={setTab} value={tab}>
                <Flex align="center" gap="3" justify="between" mb="2">
                    <Tabs.List>
                        <Tabs.Trigger value="general">일반</Tabs.Trigger>
                        <Tabs.Trigger value="block">차단</Tabs.Trigger>
                        <Tabs.Trigger value="memo">메모</Tabs.Trigger>
                        <Tabs.Trigger value="module">모듈</Tabs.Trigger>
                        <Tabs.Trigger value="shortcut">단축키</Tabs.Trigger>
                        <Tabs.Trigger value="data">데이터</Tabs.Trigger>
                    </Tabs.List>

                    {embedded && (
                        <IconButton
                            color="gray"
                            onClick={() => void browser.runtime.openOptionsPage()}
                            size="2"
                            title="전체 설정 페이지 열기"
                            variant="ghost"
                        >
                            <ExternalLink size={14}/>
                        </IconButton>
                    )}
                </Flex>

                <Box style={embedded ? {flexGrow: 1, overflowY: "auto"} : undefined}>
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
                </Box>
            </Tabs.Root>
        </AppContext.Provider>
    );

    return (
        <Theme appearance={appearance} grayColor="slate" radius="medium">
            {embedded ? (
                <Box
                    px="4"
                    py="3"
                    style={{display: "flex", flexDirection: "column", height: "100%", width: 700}}
                >
                    {content}
                </Box>
            ) : (
                <Container px="4" py="6" size="3">{content}</Container>
            )}
        </Theme>
    );
}
