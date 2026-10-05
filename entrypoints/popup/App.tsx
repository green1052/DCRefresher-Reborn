import {Ban, type LucideIcon, NotebookPen, Puzzle, Settings} from "lucide-react";
import {type ReactNode, useEffect, useId, useState} from "react";

import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Card, CardContent} from "@/components/ui/card";
import {Field, FieldContent, FieldDescription, FieldLabel} from "@/components/ui/field";
import {Switch} from "@/components/ui/switch";
import {Toggle} from "@/components/ui/toggle";
import {type PageAction, type PageToggleState, sendMessage} from "@/core/messaging/protocol";
import {backupStorage} from "@/core/storage/items";
import features from "@/features/meta";
import {initBlocksStore, useBlocksStore} from "@/stores/blocks";
import {initMemosStore, useMemosStore} from "@/stores/memos";
import {initModulesStore, useExtensionPageVars, useModulesStore} from "@/stores/modules";

const LOGO_URL = browser.runtime.getURL("/icons/48.png");
const VERSION = browser.runtime.getManifest().version;

interface Page {
    tabId: number;
    gallery: string;
    /** 처음 물었을 때의 탭 상태. 콘텐츠 스크립트가 없으면 null */
    state: PageToggleState[] | null;
}

/** 활성 탭이 디시 갤러리 페이지면 탭과 갤러리 id를 돌려준다. tabs 권한이 없어 탭 주소는 host_permissions가 있는 디시 탭에서만 보인다. */
const findPage = async (): Promise<Page | null> => {
    const [tab] = await browser.tabs.query({active: true, currentWindow: true});
    const url = tab?.url ? URL.parse(tab.url) : null;
    const gallery = url?.hostname === "gall.dcinside.com" ? url.searchParams.get("id") : null;
    if (tab?.id === undefined || !gallery) return null;

    // 설치 전에 열린 탭 등 콘텐츠 스크립트가 없으면 토글 없이 보여 준다.
    const state = await sendMessage("refresher:pageState", undefined, tab.id).catch(() => null);
    return {tabId: tab.id, gallery, state};
};

// openOptionsPage는 이미 열린 옵션 탭이 있으면 그 탭으로 간다.
const openOptions = async (): Promise<void> => {
    await browser.runtime.openOptionsPage();
    window.close();
};

/** 토글 아이콘(컴포넌트)은 메시지로 보낼 수 없어 팝업이 모듈 메타(toggles)에서 찾는다. */
const toggleIcon = ({module, id}: PageAction): LucideIcon =>
    features.find((feature) => feature.id === module)?.toggles?.find((toggle) => toggle.id === id)?.icon ?? Puzzle;

const SectionTitle = ({children, aside}: { children: ReactNode; aside?: ReactNode }) => (
    <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-bold text-muted-foreground">{children}</span>
        {aside}
    </div>
);

const ToggleRow = ({icon: Icon, label, desc, checked, onChange}: {
    icon: LucideIcon;
    label: string;
    desc: string;
    checked: boolean;
    onChange: () => void;
}) => {
    const id = useId();
    return (
        <Field orientation="horizontal" className="items-center">
            {/* 켜지면 강조색. */}
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors data-on:bg-primary/15 data-on:text-primary"
                  data-on={checked || undefined}><Icon size={15}/></span>
            <FieldContent>
                <FieldLabel htmlFor={id}>{label}</FieldLabel>
                <FieldDescription>{desc}</FieldDescription>
            </FieldContent>
            <Switch id={id} size="sm" checked={checked} onCheckedChange={onChange}/>
        </Field>
    );
};

/** toggled: 팝업에서 모듈 on/off를 저장한 횟수. 0이면 처음 물은 상태(initial) 그대로다. */
function PageSection({tabId, gallery, state: initial, toggled}: Page & { toggled: number }) {
    const blocks = useBlocksStore((state) => state.entries);
    const memos = useMemosStore((state) => state.memos);
    const [state, setState] = useState(initial);

    // 모듈을 켜고 끄면 탭의 모듈도 멈추거나 시작하므로 다시 묻는다. 저장이 끝난 뒤에 물어야 탭이 새 값으로 답한다
    // (탭은 저장소를 다시 읽고 모듈이 다 뜬 뒤에 답한다). 늦게 온 이전 응답은 버린다.
    useEffect(() => {
        if (toggled === 0) return;
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
    }, [tabId, toggled]);

    const act = (action: PageAction): void => void sendMessage("refresher:pageAction", action, tabId).then(setState, () => setState(null));

    // 모든 갤러리용 + 이 갤러리 전용.
    const visible = (entry: { gallery?: string }): boolean => !entry.gallery || entry.gallery === gallery;
    const blockCount = Object.values(blocks).flat().filter(visible).length;
    const memoCount = Object.values(memos).flatMap((map) => Object.values(map)).filter(visible).length;

    return (
        <div>
            <SectionTitle aside={
                <div className="flex gap-1">
                    <Badge variant="secondary"><Ban/> 차단 {blockCount}</Badge>
                    <Badge variant="secondary"><NotebookPen/> 메모 {memoCount}</Badge>
                </div>
            }>
                현재 페이지
            </SectionTitle>

            {/* 확장을 업데이트하기 전에 열린 탭 등 콘텐츠 스크립트가 없으면 토글을 받을 수 없다. */}
            {state === null && <p className="text-center text-xs text-muted-foreground">페이지를 새로고침하면 이 페이지 설정이 나옵니다.</p>}
            {/* 이 페이지에서 끌 수 있는 것이 없어도 빈 칸으로 두지 않는다. */}
            {state?.length === 0 && <p className="text-center text-xs text-muted-foreground">이 페이지에는 끌 수 있는 설정이 없습니다.</p>}
            {state && state.length > 0 && (
                <Card className="py-3">
                    <CardContent className="flex flex-col gap-3 px-3">
                        {state.map((toggle) => (
                            <ToggleRow key={`${toggle.module}:${toggle.id}`} icon={toggleIcon(toggle)} label={toggle.label} desc={toggle.desc}
                                       checked={toggle.on} onChange={() => act({module: toggle.module, id: toggle.id})}/>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

function ModulesSection({onToggled}: { onToggled: () => void }) {
    const enables = useModulesStore((state) => state.enables);
    const toggle = useModulesStore((state) => state.toggle);
    const [failed, setFailed] = useState(false);
    const on = features.filter((feature) => enables[feature.id]).length;

    return (
        <div>
            <SectionTitle aside={<span className="text-xs text-muted-foreground">{on}/{features.length} 켜짐</span>}>모듈</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
                {features.map((feature) => {
                    const enabled = enables[feature.id] === true;
                    const Icon = feature.icon;

                    return (
                        // 모듈 타일 — 누르면 켜고 끈다. 켜진 타일은 오른쪽 점이 강조색이다.
                        <Toggle key={feature.id} variant="outline" className="min-w-0 justify-start font-normal"
                                title={feature.description} pressed={enabled}
                                onPressedChange={(next) => void toggle(feature.id, next).then(() => {
                                    setFailed(false);
                                    onToggled();
                                }, () => setFailed(true))}>
                            <Icon/>
                            <span className="grow truncate text-left">{feature.name}</span>
                            <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/40 group-data-pressed/toggle:bg-primary"/>
                        </Toggle>
                    );
                })}
            </div>
            {failed && <p className="mt-2 text-center text-xs text-destructive" role="alert">저장하지 못했습니다. 팝업을 닫았다가 다시 열어 주세요.</p>}
        </div>
    );
}

export function App() {
    const [loaded, setLoaded] = useState<{ page: Page | null; backupError: string } | null>(null);
    const [toggled, setToggled] = useState(0);

    // 한 번에 그려야 팝업 크기가 여러 번 바뀌지 않는다. 모두 로컬 읽기라 금방 끝난다.
    // 하나가 실패해도 빈 팝업으로 남지 않게 기본값으로 그린다.
    useEffect(() => {
        void Promise.all([
            findPage().catch(() => null),
            // 자동 백업은 배경에서 돌아 실패해도 데이터 탭을 열기 전에는 모른다. 켜져 있을 때만 팝업에서 한 줄로 알린다.
            // 오류는 백업이 성공해야 지워지므로, 한도 초과로 자동 백업을 끈 뒤에도 알리면 경고가 사라지지 않는다 (지난 실패는 데이터 탭에 남는다).
            Promise.all([backupStorage.auto.getValue(), backupStorage.error.getValue()]).then(([auto, error]) => (auto ? error : "")).catch(() => ""),
            initBlocksStore().catch(console.error),
            initMemosStore().catch(console.error),
            initModulesStore().catch(console.error)
        ]).then(([page, backupError]) => setLoaded({page, backupError}));
    }, []);

    // 모듈이 선언한 확장 페이지 CSS 변수 (폰트 교체 등).
    useExtensionPageVars();

    if (!loaded) return null;

    return (
        <div className="flex flex-col">
            <div className="flex items-center gap-3 border-b px-4 py-3">
                <img src={LOGO_URL} alt="" width={32} height={32} className="rounded-md"/>
                <div className="min-w-0 grow">
                    <div className="font-bold">DCRefresher Reborn</div>
                    <div className="text-xs text-muted-foreground">v{VERSION}</div>
                </div>
                <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label="설정" title="설정" onClick={() => void openOptions()}>
                    <Settings/>
                </Button>
            </div>

            <div className="flex flex-col gap-4 p-3">
                {loaded.backupError && (
                    <p className="text-center text-xs text-destructive">클라우드에 백업하지 못했습니다. 설정의 데이터 탭에서 확인해 주세요.</p>
                )}
                {loaded.page ? (
                    <PageSection {...loaded.page} toggled={toggled}/>
                ) : (
                    <p className="text-center text-xs text-muted-foreground">디시인사이드 갤러리에서 열면 이 페이지 설정이 나옵니다.</p>
                )}
                <ModulesSection onToggled={() => setToggled((count) => count + 1)}/>
            </div>
        </div>
    );
}
