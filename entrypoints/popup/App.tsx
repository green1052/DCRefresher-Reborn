import {Flex, Grid, Heading, IconButton, Separator, Switch, Text} from "@radix-ui/themes";
import {Settings} from "lucide-react";
import {type ReactNode, useEffect, useState} from "react";

import {type PageAction, type PageState, sendMessage} from "@/core/messaging/protocol";
import features from "@/features";
import {initBlocksStore, useBlocksStore} from "@/stores/blocks";
import {initMemosStore, useMemosStore} from "@/stores/memos";
import {initModulesStore, useModulesStore} from "@/stores/modules";

const LOGO_URL = browser.runtime.getURL("/icons/48.png");
const VERSION = browser.runtime.getManifest().version;

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

const Section = ({title, children}: { title: string; children: ReactNode }) => (
    <Flex direction="column" gap="2">
        <Text size="1" weight="medium" color="gray">{title}</Text>
        {children}
    </Flex>
);

const SwitchRow = ({label, checked, onChange}: { label: string; checked: boolean; onChange: (value: boolean) => void }) => (
    <Text as="label" size="2">
        <Flex justify="between" align="center" gap="2">
            {label}
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
        <Section title="현재 페이지">
            <Text size="2" color="gray">차단 {blockCount}개 · 메모 {memoCount}개</Text>
            {state?.refresh && <SwitchRow label="새로고침 일시정지" checked={state.refresh.paused} onChange={() => act("toggleRefresh")}/>}
            {state?.stealth && <SwitchRow label="이미지 잠시 보이기" checked={state.stealth.revealed} onChange={() => act("toggleStealth")}/>}
            {state?.block && (
                <SwitchRow label={`가린 내용 보기 (${state.block.hidden}개)`} checked={state.block.revealed}
                           onChange={() => act("toggleBlockReveal")}/>
            )}
        </Section>
    );
}

function ModulesSection() {
    const enables = useModulesStore((state) => state.enables);
    const toggle = useModulesStore((state) => state.toggle);

    return (
        <Section title="모듈">
            <Grid columns="2" gapX="4" gapY="2">
                {features.map((feature) => (
                    <SwitchRow
                        key={feature.id}
                        label={feature.name}
                        checked={enables[feature.id] ?? true}
                        onChange={(value) => void toggle(feature.id, value)}
                    />
                ))}
            </Grid>
        </Section>
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

    if (!loaded) return null;
    const {page} = loaded;

    return (
        <Flex direction="column" gap="3" p="3">
            <Flex align="center" gap="2">
                <img src={LOGO_URL} alt="" width={24} height={24} style={{borderRadius: "var(--radius-2)"}}/>
                <Heading size="3">DCRefresher Reborn</Heading>
                <Text size="1" color="gray" ml="auto">v{VERSION}</Text>
                <IconButton size="1" variant="ghost" color="gray" aria-label="설정" title="설정" onClick={() => void openOptions()}>
                    <Settings size={16}/>
                </IconButton>
            </Flex>

            {page && (
                <>
                    <Separator size="4"/>
                    <PageSection {...page}/>
                </>
            )}

            <Separator size="4"/>
            <ModulesSection/>
        </Flex>
    );
}
