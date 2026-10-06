import {Ban, Database, Info, Keyboard, type LucideIcon, NotebookPen, Settings} from "lucide-react";
import {lazy, Suspense, useEffect, useState, useSyncExternalStore} from "react";

import {Notice} from "@/components/dialogs";
import {Button} from "@/components/ui/button";
import {Separator} from "@/components/ui/separator";
import {initBlocksStore} from "@/stores/blocks";
import {initMemosStore} from "@/stores/memos";
import {initModulesStore, useExtensionPageVars} from "@/stores/modules";
import {cn} from "cn";

import {AboutTab} from "./AboutTab";
import {BlockTab} from "./BlockTab";
import {DataTab} from "./DataTab";
import {GeneralTab} from "./GeneralTab";
import {MemoTab} from "./MemoTab";
import {useOptionsStore} from "./optionsStore";
import {ShortcutTab} from "./ShortcutTab";

// 디시콘 비는 드물게 열리므로 옵션 페이지를 열 때 같이 불러오지 않는다.
const DcconRain = lazy(() => import("./DcconRain").then(({DcconRain}) => ({default: DcconRain})));

interface TabDef {
    id: string;
    label: string;
    icon: LucideIcon;
    content: () => React.ReactNode;
}

const TABS: TabDef[] = [
    {id: "general", label: "설정", icon: Settings, content: () => <GeneralTab/>},
    {id: "block", label: "차단", icon: Ban, content: () => <BlockTab/>},
    {id: "memo", label: "메모", icon: NotebookPen, content: () => <MemoTab/>},
    {id: "shortcut", label: "단축키", icon: Keyboard, content: () => <ShortcutTab/>},
    {id: "data", label: "데이터", icon: Database, content: () => <DataTab/>},
    {id: "about", label: "정보", icon: Info, content: () => <AboutTab logo={LOGO_URL} version={VERSION}/>}
];

const LOGO_URL = browser.runtime.getURL("/icons/128.png");

const VERSION = browser.runtime.getManifest().version + (import.meta.env.DEV ? "-dev" : "");

/** 현재 탭은 location.hash에 둬서 새로고침하거나 링크를 공유해도 유지되게 한다. */
const readHash = (): string => {
    const id = location.hash.slice(1);
    return TABS.some((tab) => tab.id === id) ? id : TABS[0]!.id;
};

const subscribeHash = (onChange: () => void): (() => void) => {
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
};

const Sidebar = ({tab, onSelect}: {
    tab: string;
    onSelect: (id: string) => void;
}) => (
    <div className="flex w-full shrink-0 flex-col gap-4 border-r p-4 md:sticky md:top-0 md:h-screen md:w-60">
        <div className="flex items-center gap-3 px-2">
            <img src={LOGO_URL} alt="" width={36} height={36} className="cursor-pointer rounded-md" onClick={() => useOptionsStore.getState().startRain()}/>
            {/* h1은 본문의 탭 제목 하나만 둔다. 모양만 제목으로 그린다. */}
            <p className="font-bold">DCRefresher Reborn</p>
        </div>

        <nav className="flex flex-wrap gap-1 md:flex-col md:flex-nowrap">
            {TABS.map(({id, label, icon: Icon}) => (
                <Button
                    key={id}
                    size="lg"
                    variant="ghost"
                    aria-current={tab === id ? "page" : undefined}
                    className={cn("justify-start", tab === id && "bg-muted")}
                    onClick={() => onSelect(id)}
                >
                    <Icon data-icon="inline-start"/> {label}
                </Button>
            ))}
        </nav>

        <div className="mt-auto hidden md:block">
            <Separator className="mb-3"/>
            <p className="px-2 text-xs text-muted-foreground">v{VERSION}</p>
        </div>
    </div>
);

export function App() {
    const tab = useSyncExternalStore(subscribeHash, readHash);
    const rain = useOptionsStore((state) => state.rain);
    const notice = useOptionsStore((state) => state.notice);
    const current = TABS.find((item) => item.id === tab) ?? TABS[0]!;
    const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");

    useEffect(() => {
        // 읽기 전이나 읽기에 실패한 채 그리면 빈 목록에서 고친 결과(전체 삭제·추가·가져오기)가 저장된 목록을 덮으므로 탭을 그리지 않는다.
        Promise.all([initBlocksStore(), initMemosStore(), initModulesStore()]).then(
            () => setStatus("ready"),
            (e) => {
                console.error(e);
                setStatus("failed");
            }
        );
    }, []);

    useExtensionPageVars();

    return (
        <div className="flex min-h-screen flex-col md:flex-row">
            <Sidebar tab={current.id} onSelect={(id) => (location.hash = id)}/>
            {/* 누를 때마다 새로 마운트한다. React Compiler가 Math.random으로 그린 결과를 기억해 같은 모양이 반복되기 때문이다. */}
            {rain > 0 && <Suspense><DcconRain key={rain}/></Suspense>}
            <Notice message={notice} onClose={() => useOptionsStore.setState({notice: null})}/>

            <div className="min-w-0 grow px-4 py-8 md:px-8">
                {/* 탭마다 새로 마운트해 들어오는 애니메이션을 다시 건다.
                    연 버튼이 막혀(데이터 초기화 중) 돌아갈 곳이 없으면 다이얼로그가 포커스를 이 탭으로 돌려준다 (useReturnFocus). */}
                <div key={current.id} className="tab-enter mx-auto max-w-[880px] outline-none" tabIndex={-1}>
                    <h1 className="mb-6 text-2xl font-bold">{current.label}</h1>
                    {status === "failed"
                        ? <p className="text-destructive">저장된 데이터를 읽지 못했습니다. 페이지를 새로고침해 주세요.</p>
                        : status === "ready" && current.content()}
                </div>
            </div>
        </div>
    );
}
