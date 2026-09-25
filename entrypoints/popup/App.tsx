import {Badge, Box, Card, Flex, Grid, IconButton, Switch, Text} from "@radix-ui/themes";
import {
    Ban,
    Eye,
    EyeOff,
    Image,
    LayoutPanelTop,
    type LucideIcon,
    NotebookPen,
    Pause,
    PenLine,
    Puzzle,
    RefreshCw,
    ScanSearch,
    Settings,
    ShieldCheck,
    SquareMousePointer,
    Type,
    UserRound
} from "lucide-react";
import {type ReactNode, useEffect, useState} from "react";

import {type PageAction, type PageState, sendMessage} from "@/core/messaging/protocol";
import features from "@/features";
import {fontFamilyOf} from "@/features/fonts";
import {initBlocksStore, useBlocksStore} from "@/stores/blocks";
import {initMemosStore, useMemosStore} from "@/stores/memos";
import {initModulesStore, useModulesStore} from "@/stores/modules";

const LOGO_URL = browser.runtime.getURL("/icons/48.png");
const VERSION = browser.runtime.getManifest().version;

/** 모듈 타일 아이콘 (없으면 퍼즐) */
const MODULE_ICONS: Record<string, LucideIcon> = {
    block: Ban,
    fonts: Type,
    imagesearch: ScanSearch,
    layout: LayoutPanelTop,
    manage: ShieldCheck,
    preview: SquareMousePointer,
    refresh: RefreshCw,
    stealth: EyeOff,
    userinfo: UserRound,
    write: PenLine
};

interface Page {
    tabId: number;
    gallery: string;
    /** 처음 물었을 때의 탭 상태 — 콘텐츠 스크립트가 없으면 null */
    state: PageState | null;
}

/** 활성 탭이 디시 갤러리 페이지면 탭과 갤러리 id — 탭 주소는 host_permissions가 있는 디시 탭에서만 보인다 */
const findPage = async (): Promise<Page | null> => {
    const [tab] = await browser.tabs.query({active: true, currentWindow: true});
    const url = tab?.url ? URL.parse(tab.url) : null;
    const gallery = url?.hostname === "gall.dcinside.com" ? url.searchParams.get("id") : null;
    if (tab?.id === undefined || !gallery) return null;

    // 설치 전에 열린 탭 등 콘텐츠 스크립트가 없으면 토글 없이 보여 준다
    const state = await sendMessage("refresher:pageState", undefined, tab.id).catch(() => null);
    return {tabId: tab.id, gallery, state};
};

// 이미 열린 옵션 탭이 있으면 그 탭으로 간다
const openOptions = async (): Promise<void> => {
    await browser.runtime.openOptionsPage();
    window.close();
};

const SectionTitle = ({children, aside}: { children: ReactNode; aside?: ReactNode }) => (
    <Flex justify="between" align="center" px="1" mb="2">
        <Text size="1" weight="bold" color="gray">{children}</Text>
        {aside}
    </Flex>
);

const ToggleRow = ({icon: Icon, label, desc, checked, onChange}: {
    icon: LucideIcon;
    label: string;
    desc: string;
    checked: boolean;
    onChange: () => void;
}) => (
    <Text as="label" size="2">
        <Flex align="center" gap="3" py="1">
            <span className="popup-icon" data-on={checked || undefined}><Icon size={15}/></span>
            <Box flexGrow="1" minWidth="0">
                <Text as="div" size="2" weight="medium">{label}</Text>
                <Text as="div" size="1" color="gray">{desc}</Text>
            </Box>
            <Switch size="1" checked={checked} onCheckedChange={onChange}/>
        </Flex>
    </Text>
);

function PageSection({tabId, gallery, state: initial}: Page) {
    const blocks = useBlocksStore((state) => state.entries);
    const memos = useMemosStore((state) => state.memos);
    const enables = useModulesStore((state) => state.enables);
    const [state, setState] = useState(initial);

    // 모듈을 켜고 끄면 탭의 모듈도 멈추거나 시작하므로 다시 묻는다. 늦게 온 이전 응답은 버린다
    useEffect(() => {
        let current = true;
        sendMessage("refresher:pageState", undefined, tabId).then(
            (next) => {
                if (current) setState(next);
            },
            () => {
                if (current) setState(null);
            }
        );
        return () => {
            current = false;
        };
    }, [tabId, enables]);

    const act = (action: PageAction): void => void sendMessage("refresher:pageAction", action, tabId).then(setState, () => {});

    // 모든 갤러리용 + 이 갤러리 전용
    const visible = (entry: { gallery?: string }): boolean => !entry.gallery || entry.gallery === gallery;
    const blockCount = Object.values(blocks).flat().filter(visible).length;
    const memoCount = Object.values(memos).flatMap((map) => Object.values(map)).filter(visible).length;

    return (
        <Box>
            <SectionTitle aside={
                <Flex gap="1">
                    <Badge size="1" variant="soft" color="gray" radius="full"><Ban size={11}/> 차단 {blockCount}</Badge>
                    <Badge size="1" variant="soft" color="gray" radius="full"><NotebookPen size={11}/> 메모 {memoCount}</Badge>
                </Flex>
            }>
                현재 페이지
            </SectionTitle>

            {state && (state.refresh || state.stealth || state.block) && (
                <Card size="1">
                    <Flex direction="column" gap="1">
                        {state.refresh && (
                            <ToggleRow icon={Pause} label="새로고침 일시정지" desc="이 탭의 자동 새로고침을 멈춥니다"
                                       checked={state.refresh.paused} onChange={() => act("toggleRefresh")}/>
                        )}
                        {state.stealth && (
                            <ToggleRow icon={Image} label="이미지 잠시 보이기" desc="스텔스로 숨긴 이미지를 보입니다"
                                       checked={state.stealth.revealed} onChange={() => act("toggleStealth")}/>
                        )}
                        {state.block && (
                            <ToggleRow icon={Eye} label="가린 내용 보기" desc={`가린 ${state.block.hidden}개를 흐리게 보입니다`}
                                       checked={state.block.revealed} onChange={() => act("toggleBlockReveal")}/>
                        )}
                    </Flex>
                </Card>
            )}
        </Box>
    );
}

function ModulesSection() {
    const enables = useModulesStore((state) => state.enables);
    const toggle = useModulesStore((state) => state.toggle);
    const on = features.filter((feature) => enables[feature.id] ?? true).length;

    return (
        <Box>
            <SectionTitle aside={<Text size="1" color="gray">{on}/{features.length} 켜짐</Text>}>모듈</SectionTitle>
            <Grid columns="2" gap="2">
                {features.map((feature) => {
                    const Icon = MODULE_ICONS[feature.id] ?? Puzzle;
                    const enabled = enables[feature.id] ?? true;

                    return (
                        <button key={feature.id} type="button" className="module-tile" aria-pressed={enabled}
                                title={feature.description} onClick={() => void toggle(feature.id, !enabled)}>
                            <Icon size={15}/>
                            <span className="module-name">{feature.name}</span>
                            <span className="module-dot"/>
                        </button>
                    );
                })}
            </Grid>
        </Box>
    );
}

export function App() {
    const [loaded, setLoaded] = useState<{ page: Page | null } | null>(null);

    // 한 번에 그려야 팝업 크기가 여러 번 바뀌지 않는다 — 모두 로컬 읽기라 금방 끝난다.
    // 하나가 실패해도 빈 팝업으로 남지 않게 기본값으로 그린다
    useEffect(() => {
        void Promise.all([
            findPage().catch(() => null),
            initBlocksStore().catch(console.error),
            initMemosStore().catch(console.error),
            initModulesStore().catch(console.error)
        ]).then(([page]) => setLoaded({page}));
    }, []);

    // 폰트 교체 모듈 설정을 팝업에도 (옵션 페이지와 같게)
    const fontsEnabled = useModulesStore((state) => state.enables.fonts);
    const customFonts = useModulesStore((state) => state.values.fonts?.customFonts);
    useEffect(() => {
        const root = document.documentElement.style;
        if (fontsEnabled) root.setProperty("--refresher-font", fontFamilyOf(String(customFonts ?? "")));
        else root.removeProperty("--refresher-font");
    }, [fontsEnabled, customFonts]);

    if (!loaded) return null;

    return (
        <Flex direction="column">
            <Flex align="center" gap="3" px="4" py="3" className="popup-header">
                <img src={LOGO_URL} alt="" width={32} height={32} style={{borderRadius: "var(--radius-3)"}}/>
                <Box flexGrow="1" minWidth="0">
                    <Text as="div" size="3" weight="bold">DCRefresher Reborn</Text>
                    <Text as="div" size="1" color="gray">v{VERSION}</Text>
                </Box>
                <IconButton size="2" variant="ghost" color="gray" aria-label="설정" title="설정" onClick={() => void openOptions()}>
                    <Settings size={18}/>
                </IconButton>
            </Flex>

            <Flex direction="column" gap="4" p="3">
                {loaded.page ? (
                    <PageSection {...loaded.page}/>
                ) : (
                    <Text size="1" color="gray" align="center">디시인사이드 갤러리에서 열면 이 페이지 설정이 나옵니다.</Text>
                )}
                <ModulesSection/>
            </Flex>
        </Flex>
    );
}
