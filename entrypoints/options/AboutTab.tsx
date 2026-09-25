import {Badge, Box, Button, DataList, Flex, Grid, Heading, Link, Text} from "@radix-ui/themes";
import {BookOpen, Bug, ClipboardCopy, Code, Heart, type LucideIcon, MessageCircle, Star, Tag, Users} from "lucide-react";
import {HTTPError} from "ky";
import {useEffect, useState} from "react";

import {Notice} from "@/components/ConfirmDialog";
import {http} from "@/core/http/client";
import {dbStorage} from "@/core/storage/items";
import features from "@/features";
import {useBlocksStore} from "@/stores/blocks";
import {useMemosStore} from "@/stores/memos";
import {useModulesStore} from "@/stores/modules";

import {byteSize, formatBytes, formatTime, Section} from "./Layout";

const REPO = "https://github.com/green1052/DCRefresher-Reborn";

const STORE = import.meta.env.FIREFOX
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

/** storage.sync 전체 한도 */
const SYNC_QUOTA = 102_400;

type Release = { body: string; url: string; date: string } | "loading" | "missing" | "error";

/** 탭을 오갈 때마다 다시 받지 않는다 — GitHub 비로그인 API는 시간당 60회 */
const releases = new Map<string, Promise<Release>>();

/** 이 버전의 릴리스 노트 — 태그가 버전 그대로다 (build.yml). 개발 빌드의 -dev는 뗀다 */
const useRelease = (version: string): Release => {
    const [release, setRelease] = useState<Release>("loading");

    useEffect(() => {
        let promise = releases.get(version);
        if (!promise) {
            promise = http.get(`https://api.github.com/repos/green1052/DCRefresher-Reborn/releases/tags/${version.replace(/-dev$/, "")}`)
                .json<{ body?: string; html_url: string; published_at: string }>()
                .then((data): Release => ({body: data.body?.trim() || "(내용 없음)", url: data.html_url, date: data.published_at}))
                // 404만 "없음"이고 캐시한다 — 한도 초과(403)·네트워크 오류는 따로 알리고 다음에 다시 받는다
                .catch((e): Release => {
                    if (e instanceof HTTPError && e.response.status === 404) return "missing";
                    releases.delete(version);
                    return "error";
                });
            releases.set(version, promise);
        }
        void promise.then(setRelease);
    }, [version]);

    return release;
};

interface Usage {
    local: number;
    sync: number;
}

// 로컬의 getBytesInUse는 Firefox 144부터라 JSON 크기로 잰다 (sync는 한도 계산과 같게 브라우저 값을 쓴다)
const readUsage = async (): Promise<Usage> => {
    const [local, sync] = await Promise.all([browser.storage.local.get(null).then(byteSize), browser.storage.sync.getBytesInUse(null)]);
    return {local, sync};
};

export function AboutTab({logo, version}: { logo: string; version: string }) {
    const release = useRelease(version);
    const enables = useModulesStore((state) => state.enables);
    const blocks = useBlocksStore((state) => state.entries);
    const memos = useMemosStore((state) => state.memos);
    const [usage, setUsage] = useState<Usage | null | "error">(null);
    const [notice, setNotice] = useState<string | null>(null);

    useEffect(() => {
        readUsage().then(setUsage, () => setUsage("error"));
    }, []);

    const blockCount = Object.values(blocks).reduce((sum, list) => sum + list.length, 0);
    const memoCount = Object.values(memos).reduce((sum, map) => sum + Object.keys(map).length, 0);
    const enabledNames = features.filter((feature) => enables[feature.id] ?? true).map((feature) => feature.name);

    const copyDiagnostics = async (): Promise<void> => {
        const db = await dbStorage.getValue().catch(() => null);
        const lines = [
            `DCRefresher Reborn v${version} (${import.meta.env.BROWSER})`,
            `브라우저: ${navigator.userAgent}`,
            `켜진 모듈: ${enabledNames.join(", ") || "없음"}`,
            `IP DB: ${db?.version ?? "없음"} (갱신 ${formatTime(db?.lastUpdate ?? 0)})`,
            `차단 ${blockCount}개 · 메모 ${memoCount}개`
        ];
        try {
            await navigator.clipboard.writeText(lines.join("\n"));
            setNotice("진단 정보를 복사했습니다. 버그 제보에 붙여 넣어 주세요.");
        } catch {
            setNotice("복사하지 못했습니다.");
        }
    };

    return (
        <Box>
            <Section>
                <Flex align="center" gap="4" wrap="wrap">
                    <img src={logo} alt="" width={64} height={64} style={{borderRadius: "var(--radius-4)"}}/>
                    <Box flexGrow="1">
                        <Flex align="center" gap="2">
                            <Heading size="5">DCRefresher Reborn</Heading>
                            <Badge variant="soft">v{version}</Badge>
                        </Flex>
                        <Text as="p" size="2" color="gray">디시인사이드 개선 확장 프로그램</Text>
                    </Box>
                    <Button variant="soft" onClick={() => void copyDiagnostics()}>
                        <ClipboardCopy size={14}/> 진단 정보 복사
                    </Button>
                </Flex>
            </Section>

            <Section title="바로가기">
                <Grid columns={{initial: "1", sm: "2"}} gap="2">
                    {LINKS.map(([label, url, Icon]) => (
                        <Button key={label} asChild variant="soft" color="gray" style={{justifyContent: "flex-start"}}>
                            <a href={url} target="_blank" rel="noreferrer">
                                <Icon size={14}/> {label}
                            </a>
                        </Button>
                    ))}
                </Grid>
            </Section>

            <Section
                title="이번 버전에서 달라진 점"
                desc={typeof release === "object" ? formatTime(Date.parse(release.date)) : undefined}
                actions={typeof release === "object" && (
                    <Button asChild variant="ghost" size="1">
                        <a href={release.url} target="_blank" rel="noreferrer">GitHub에서 보기</a>
                    </Button>
                )}
            >
                {release === "loading" ? (
                    <Text size="2" color="gray">불러오는 중…</Text>
                ) : release === "missing" || release === "error" ? (
                    <Text size="2" color="gray">
                        {release === "missing" ? "이 버전의 릴리스 노트를 찾지 못했습니다." : "릴리스 노트를 불러오지 못했습니다. (GitHub 요청 한도 초과 등)"}{" "}
                        <Link href={`${REPO}/releases`} target="_blank">전체 업데이트 내역</Link>을 확인해 주세요.
                    </Text>
                ) : (
                    <Text as="p" size="2" style={{whiteSpace: "pre-wrap", maxHeight: 320, overflowY: "auto"}}>{release.body}</Text>
                )}
            </Section>

            <Section title="데이터 현황">
                <DataList.Root>
                    <DataList.Item>
                        <DataList.Label>차단 · 메모</DataList.Label>
                        <DataList.Value>차단 {blockCount}개 · 메모 {memoCount}개</DataList.Value>
                    </DataList.Item>
                    <DataList.Item>
                        <DataList.Label>로컬 저장소</DataList.Label>
                        <DataList.Value>{usage === "error" ? "알 수 없음" : usage ? formatBytes(usage.local) : "…"}</DataList.Value>
                    </DataList.Item>
                    <DataList.Item>
                        <DataList.Label>클라우드 저장소</DataList.Label>
                        <DataList.Value>
                            {usage === "error" ? "알 수 없음" : usage ? `${formatBytes(usage.sync)} / ${formatBytes(SYNC_QUOTA)} (${Math.round((usage.sync / SYNC_QUOTA) * 100)}%)` : "…"}
                        </DataList.Value>
                    </DataList.Item>
                </DataList.Root>
            </Section>

            <Notice message={notice} onClose={() => setNotice(null)}/>
        </Box>
    );
}
