import {Badge, Box, Button, Code, DataList, Flex, IconButton, SegmentedControl, Text, TextField, Tooltip} from "@radix-ui/themes";
import {ChevronRight, Copy, EyeOff, FileJson, RefreshCw, RotateCcw, Trash2} from "lucide-react";
import {Collapsible} from "radix-ui";
import {useEffect, useRef, useState, useSyncExternalStore} from "react";
import {storage} from "wxt/utils/storage";
import {arrayIncludes, objectKeys} from "ts-extras";

import {ConfirmDialog} from "@/components/ConfirmDialog";
import {isModuleDataKey} from "@/core/storage/items";
import {databaseVersion, initDatabase, ipInfoOf, parseBans, subscribeDatabase} from "@/core/database";
import {IP_FORMAT, parseIpData} from "@/core/ipdb";
import {DB_KEYS, dbStorage, writeDatabase} from "@/core/storage/items";

import {byteSize, Empty, formatBytes, formatTime, Section, useStorageItem} from "./Layout";
import {notify, useOptionsStore} from "./optionsStore";

/** 개발자 탭에서만 보는 ip·ban 원문. 이 탭은 App.tsx에서 lazy로 불러오므로 다른 페이지는 이 수백 KB를 읽지 않는다 */
const dbIp = storage.defineItem<string>(DB_KEYS.ip, {fallback: ""});
const dbBan = storage.defineItem<string>(DB_KEYS.ban, {fallback: ""});

type Area = "local" | "sync";

const AREA_NAMES: Record<Area, string> = {local: "로컬", sync: "클라우드"};

/** 표시용 JSON의 문자열 하나(IP 표 base64 등)와 전체 길이 상한. 잘라서 DOM이 커지지 않게 한다 */
const MAX_STRING = 200;
const MAX_TEXT = 50_000;

const preview = (value: unknown): string => {
    const text = JSON.stringify(
        value,
        (_, item: unknown) => (typeof item === "string" && item.length > MAX_STRING ? `${item.slice(0, MAX_STRING)}… (${item.length}자)` : item),
        2
    );
    return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}\n… (${text.length}자 중 ${MAX_TEXT}자만 표시)` : text;
};

/** 저장소 영역의 전체 내용. 다른 탭이나 콘텐츠 스크립트에서 바뀌어도 따라간다 */
const useStorageArea = (area: Area): Record<string, unknown> | null => {
    const [items, setItems] = useState<Record<string, unknown> | null>(null);

    useEffect(() => {
        // 영역을 바꾼 뒤 늦게 온 이전 영역의 값이 덮어쓰지 않게 한다
        let alive = true;
        const load = (): void =>
            void browser.storage[area].get(null).then((next) => {
                if (alive) setItems(next);
            });
        // 바뀐 키만 반영한다. 다시 읽으면 글댓비를 저장할 때마다 1MB가 넘는 IP·밴 DB까지 읽는다
        const onChanged = (changes: Record<string, { newValue?: unknown }>, changedArea: string): void => {
            if (changedArea !== area) return;
            setItems((previous) => {
                if (!previous) return previous;
                const next = {...previous};
                for (const [key, {newValue}] of Object.entries(changes)) {
                    if (newValue === undefined) delete next[key];
                    else next[key] = newValue;
                }
                return next;
            });
        };

        setItems(null);
        load();
        browser.storage.onChanged.addListener(onChanged);
        return () => {
            alive = false;
            browser.storage.onChanged.removeListener(onChanged);
        };
    }, [area]);

    return items;
};

const StorageEntry = ({name, value, onDelete}: { name: string; value: unknown; onDelete: () => void }) => {
    const [open, setOpen] = useState(false);

    return (
        <Collapsible.Root open={open} onOpenChange={setOpen} asChild>
            <Box py="2" style={{borderTop: "1px solid var(--gray-a4)"}}>
                <Flex align="center" gap="2">
                    <Collapsible.Trigger asChild>
                        <IconButton size="1" variant="ghost" color="gray" aria-label={open ? "접기" : "펼치기"}>
                            <ChevronRight size={14} style={{transform: open ? "rotate(90deg)" : undefined, transition: "transform 0.15s"}}/>
                        </IconButton>
                    </Collapsible.Trigger>
                    <Code size="2" variant="ghost" style={{flex: 1, minWidth: 0, overflowWrap: "anywhere"}}>{name}</Code>
                    <Text size="1" color="gray" style={{fontVariantNumeric: "tabular-nums"}}>{formatBytes(byteSize(value))}</Text>
                    <Tooltip content="JSON 복사">
                        <IconButton size="1" variant="ghost" color="gray" aria-label="JSON 복사"
                                    onClick={() => void navigator.clipboard.writeText(JSON.stringify(value, null, 2))}>
                            <Copy size={14}/>
                        </IconButton>
                    </Tooltip>
                    <Tooltip content="삭제">
                        <IconButton size="1" variant="ghost" color="red" aria-label="삭제" onClick={onDelete}>
                            <Trash2 size={14}/>
                        </IconButton>
                    </Tooltip>
                </Flex>
                <Collapsible.Content className="refresher-collapsible">
                    <Box asChild mt="2" p="3" style={{
                        maxHeight: 360,
                        overflow: "auto",
                        margin: 0,
                        borderRadius: "var(--radius-2)",
                        background: "var(--gray-a3)",
                        fontFamily: "var(--code-font-family)",
                        fontSize: "var(--font-size-1)",
                        whiteSpace: "pre"
                    }}>
                        <pre>{preview(value)}</pre>
                    </Box>
                </Collapsible.Content>
            </Box>
        </Collapsible.Root>
    );
};

const StorageSection = () => {
    const [area, setArea] = useState<Area>("local");
    const [deleting, setDeleting] = useState<string | null>(null);
    const items = useStorageArea(area);
    const entries = Object.entries(items ?? {}).sort(([a], [b]) => a.localeCompare(b));
    const total = entries.reduce((sum, [, value]) => sum + byteSize(value), 0);

    return (
        <Section
            title="저장된 설정"
            desc={items ? `${entries.length}개 키 · ${formatBytes(total)}` : "불러오는 중…"}
            actions={
                <SegmentedControl.Root value={area} onValueChange={(value) => arrayIncludes(objectKeys(AREA_NAMES), value) && setArea(value)}>
                    {objectKeys(AREA_NAMES).map((key) => (
                        <SegmentedControl.Item key={key} value={key}>{AREA_NAMES[key]}</SegmentedControl.Item>
                    ))}
                </SegmentedControl.Root>
            }
        >
            {items && entries.length === 0 && <Empty>저장된 값이 없습니다.</Empty>}
            {entries.map(([name, value]) => (
                <StorageEntry key={name} name={name} value={value} onDelete={() => setDeleting(name)}/>
            ))}

            {deleting !== null && (
                <ConfirmDialog
                    title={`${AREA_NAMES[area]} 저장소에서 "${deleting}"을 삭제할까요?`}
                    confirmLabel="삭제"
                    danger
                    onConfirm={() => {
                        void browser.storage[area].remove(deleting);
                        setDeleting(null);
                    }}
                    onClose={() => setDeleting(null)}
                />
            )}
        </Section>
    );
};

/** 문자열로 저장된 DB 값을 푼다. 깨졌으면 broken 값(없음)으로 대신한다 */
const parseOr = <T, >(parse: (stored: string) => T, stored: string, broken: T): T => {
    try {
        return parse(stored);
    } catch (e) {
        console.error(e);
        return broken;
    }
};

const DatabaseSection = () => {
    // React Compiler가 저장값 기준으로 메모하므로 값이 바뀔 때만 다시 푼다
    const meta = useStorageItem(dbStorage.meta);
    const ipData = parseOr(parseIpData, useStorageItem(dbIp), null);
    const banList = parseOr(parseBans, useStorageItem(dbBan), {});
    const [ip, setIp] = useState("");
    const fileInput = useRef<HTMLInputElement>(null);
    // 조회 테스트는 콘텐츠 스크립트와 같은 경로(ipInfoOf)를 쓴다.
    // DB를 읽을 때마다 올라가는 이 번호를 식에 넣어야 React Compiler가 다시 조회한다.
    const dbVersion = useSyncExternalStore(subscribeDatabase, databaseVersion);

    useEffect(() => void initDatabase().catch(console.error), []);

    const loadFile = async (file: File): Promise<void> => {
        try {
            // data 브랜치의 ip.json 형식(저장 형식)만 받는다
            const text = await file.text();
            if (!parseIpData(text)) throw new Error("형식이 올바르지 않습니다.");
            await writeDatabase({version: "local", lastUpdate: Date.now(), format: IP_FORMAT}, text, await dbBan.getValue());
            notify("IP 데이터를 파일에서 불러왔습니다. 다음 자동 갱신 때 서버 데이터로 바뀝니다.");
        } catch (e) {
            notify(`IP 데이터를 불러오지 못했습니다. ${e instanceof Error ? e.message : ""}`);
        }
    };

    const info = dbVersion > 0 && ip.trim() ? ipInfoOf(ip.trim()) : undefined;
    const banCount = Object.values(banList).reduce((sum, uids) => sum + uids.length, 0);

    return (
        <Section
            title="IP/밴 데이터베이스"
            actions={
                <>
                    <input ref={fileInput} type="file" accept=".json,application/json" hidden
                           onChange={(ev) => {
                               const file = ev.target.files?.[0];
                               ev.target.value = "";
                               if (file) void loadFile(file);
                           }}/>
                    <Button variant="soft" color="gray" onClick={() => fileInput.current?.click()}>
                        <FileJson size={14}/> IP 파일 불러오기
                    </Button>
                    <Button variant="soft" color="red" onClick={() => void storage.removeItems([dbStorage.meta, dbIp, dbBan])}>
                        <Trash2 size={14}/> 비우기
                    </Button>
                </>
            }
        >
            <DataList.Root size="2" mb="4">
                <DataList.Item>
                    <DataList.Label>버전</DataList.Label>
                    <DataList.Value>{meta.version || "없음"}</DataList.Value>
                </DataList.Item>
                <DataList.Item>
                    <DataList.Label>마지막 갱신</DataList.Label>
                    <DataList.Value>{formatTime(meta.lastUpdate)}</DataList.Value>
                </DataList.Item>
                <DataList.Item>
                    <DataList.Label>IP</DataList.Label>
                    <DataList.Value>
                        {!ipData ? "없음" : `조직 ${ipData.orgs.length} · 국가 ${ipData.countries.length} · 후보 ${ipData.meta.length / 3} · 목록 ${ipData.lists.length} · ${formatBytes(byteSize(ipData))}`}
                    </DataList.Value>
                </DataList.Item>
                <DataList.Item>
                    <DataList.Label>밴</DataList.Label>
                    <DataList.Value>{`사유 ${Object.keys(banList).length} · 유저 ${banCount}`}</DataList.Value>
                </DataList.Item>
            </DataList.Root>

            <TextField.Root aria-label="IP 조회" placeholder="IP 조회 (예: 175.223)" value={ip} onChange={(ev) => setIp(ev.target.value)}/>
            {ip.trim() && (
                <Box mt="2">
                    {info ? (
                        <>
                            <Flex align="center" gap="2">
                                <Text size="2" weight="bold">[{info.label}]</Text>
                                <Badge variant="soft">{info.category}</Badge>
                            </Flex>
                            <Text as="p" size="1" color="gray" mt="1" style={{whiteSpace: "pre-line"}}>{info.title}</Text>
                        </>
                    ) : (
                        <Text size="2" color="gray">정보 없음</Text>
                    )}
                </Box>
            )}
        </Section>
    );
};

const ToolsSection = () => {
    const clearModuleData = async (): Promise<void> => {
        const keys = Object.keys(await browser.storage.local.get(null)).filter(isModuleDataKey);
        await browser.storage.local.remove(keys);
        notify(`모듈 데이터 ${keys.length}개를 지웠습니다.`);
    };

    return (
        <Section title="도구">
            <Flex gap="2" wrap="wrap">
                <Button variant="soft" onClick={() => browser.runtime.reload()}>
                    <RefreshCw size={14}/> 확장 새로고침
                </Button>
                <Button variant="soft" color="gray" onClick={() => void clearModuleData()}>
                    <RotateCcw size={14}/> 모듈 캐시 지우기 (글댓비 등)
                </Button>
                {!import.meta.env.DEV && (
                    <Button variant="soft" color="gray" onClick={() => useOptionsStore.getState().hideDev()}>
                        <EyeOff size={14}/> 개발자 탭 숨기기
                    </Button>
                )}
            </Flex>
        </Section>
    );
};

export function DevTab() {
    return (
        <Box>
            <StorageSection/>
            <DatabaseSection/>
            <ToolsSection/>
        </Box>
    );
}
