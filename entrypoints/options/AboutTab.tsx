import {BookOpen, Bug, ClipboardCopy, Code, Heart, type LucideIcon, MessageCircle, Star, Tag, Users} from "lucide-react";
import {useEffect, useState} from "react";

import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {CLOUD_QUOTA} from "@/core/backup";
import {dbStorage} from "@/core/storage/items";
import features from "@/features/meta";
import {useBlocksStore} from "@/stores/blocks";
import {useMemosStore} from "@/stores/memos";
import {useModulesStore} from "@/stores/modules";

import {formatBytes, formatTime, Section} from "./Layout";
import {notify} from "./optionsStore";

const REPO = "https://github.com/green1052/DCRefresher-Reborn";

const STORE = import.meta.env.BROWSER === "firefox"
    ? "https://addons.mozilla.org/ko/firefox/addon/dcrefresher-reborn"
    : "https://chromewebstore.google.com/detail/pmfifcbendahnkeojgpfppklgioemgon";

const LINKS: [string, string, LucideIcon][] = [
    ["위키", `${REPO}/wiki`, BookOpen],
    ["버그 제보 / 문의", `${REPO}/issues`, Bug],
    ["업데이트 내역", `${REPO}/releases`, Tag],
    ["GitHub", REPO, Code],
    ["리프레셔 갤러리", "https://gall.dcinside.com/mini/board/lists/?id=bjwg64", Users],
    ["Discord", "https://discord.gg/SSW6Zuyjz6", MessageCircle],
    ["리뷰 남기기", STORE, Star],
    ["후원", "https://www.buymeacoffee.com/green1052", Heart]
];

interface Usage {
    local: number;
    sync: number;
}

// 브라우저가 한도를 계산하는 값과 맞추려고 getBytesInUse를 쓴다.
const readUsage = async (): Promise<Usage> => {
    const [local, sync] = await Promise.all([browser.storage.local.getBytesInUse(null), browser.storage.sync.getBytesInUse(null)]);
    return {local, sync};
};

export function AboutTab({logo, version}: { logo: string; version: string }) {
    const enables = useModulesStore((state) => state.enables);
    const blocks = useBlocksStore((state) => state.entries);
    const memos = useMemosStore((state) => state.memos);
    const [usage, setUsage] = useState<Usage | null | "error">(null);

    useEffect(() => {
        readUsage().then(setUsage, () => setUsage("error"));
    }, []);

    const blockCount = Object.values(blocks).reduce((sum, list) => sum + list.length, 0);
    const memoCount = Object.values(memos).reduce((sum, map) => sum + Object.keys(map).length, 0);
    const enabledNames = features.filter((feature) => enables[feature.id]).map((feature) => feature.name);

    const copyDiagnostics = async (): Promise<void> => {
        const db = await dbStorage.meta.getValue().catch(() => null);
        const lines = [
            `DCRefresher Reborn v${version} (${import.meta.env.BROWSER})`,
            `브라우저: ${navigator.userAgent}`,
            `켜진 모듈: ${enabledNames.join(", ") || "없음"}`,
            `IP DB: ${db?.version || "없음"} (갱신 ${formatTime(db?.lastUpdate ?? 0)})`,
            `차단 ${blockCount}개 · 메모 ${memoCount}개`
        ];
        try {
            await navigator.clipboard.writeText(lines.join("\n"));
            notify("진단 정보를 복사했습니다. 버그 제보에 붙여 넣어 주세요.");
        } catch {
            notify("복사하지 못했습니다.");
        }
    };

    return (
        <div>
            <Section>
                <div className="flex flex-wrap items-center gap-4">
                    <img src={logo} alt="" width={64} height={64} className="rounded-xl"/>
                    <div className="grow">
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-bold">DCRefresher Reborn</h2>
                            <Badge variant="secondary">v{version}</Badge>
                        </div>
                        <p className="text-muted-foreground">디시인사이드 개선 확장 프로그램</p>
                    </div>
                    <Button variant="secondary" onClick={() => void copyDiagnostics()}>
                        <ClipboardCopy data-icon="inline-start"/> 진단 정보 복사
                    </Button>
                </div>
            </Section>

            <Section title="바로가기">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {LINKS.map(([label, url, Icon]) => (
                        <Button key={label} variant="secondary" className="justify-start" nativeButton={false}
                                render={<a href={url} target="_blank" rel="noreferrer"/>}>
                            <Icon data-icon="inline-start"/> {label}
                        </Button>
                    ))}
                </div>
            </Section>

            <Section title="데이터 현황">
                <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3">
                    <dt className="text-muted-foreground">차단 · 메모</dt>
                    <dd>차단 {blockCount}개 · 메모 {memoCount}개</dd>
                    <dt className="text-muted-foreground">로컬 저장소</dt>
                    <dd>{usage === "error" ? "알 수 없음" : usage ? formatBytes(usage.local) : "…"}</dd>
                    <dt className="text-muted-foreground">클라우드 저장소</dt>
                    <dd>
                        {usage === "error" ? "알 수 없음" : usage ? `${formatBytes(usage.sync)} / ${formatBytes(CLOUD_QUOTA)} (${Math.round((usage.sync / CLOUD_QUOTA) * 100)}%)` : "…"}
                    </dd>
                </dl>
            </Section>
        </div>
    );
}
