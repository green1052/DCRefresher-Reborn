import {Badge, Box, Button, Code, DataList, Flex, IconButton, SegmentedControl, Text, TextField, Tooltip} from "@radix-ui/themes";
import {ChevronDown, ChevronRight, Copy, EyeOff, FileJson, RefreshCw, RotateCcw, Trash2} from "lucide-react";
import {useEffect, useRef, useState} from "react";

import {ConfirmDialog, Notice} from "@/components/ConfirmDialog";
import {initDatabase, ipInfoOf} from "@/core/database";
import {compactIpData, type RawIpData} from "@/core/ipdb";
import {dbStorage} from "@/core/storage/items";
import type {StoredDB} from "@/core/storage/types";

import {Empty, formatTime, Section} from "./Layout";

type Area = "local" | "sync";

const AREA_NAMES: Record<Area, string> = {local: "로컬", sync: "클라우드"};

/** 표시용 JSON — 긴 문자열(IP 표 base64 등)과 전체 길이를 잘라 DOM이 커지지 않게 */
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

const byteSize = (value: unknown): number => new Blob([JSON.stringify(value)]).size;

const formatBytes = (bytes: number): string =>
    bytes < 1024 ? `${bytes}B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)}KB` : `${(bytes / 1024 / 1024).toFixed(2)}MB`;

/** 저장소 내용 — 다른 탭/콘텐츠 스크립트에서 바뀌어도 따라간다 */
const useStorageArea = (area: Area): Record<string, unknown> | null => {
    const [items, setItems] = useState<Record<string, unknown> | null>(null);

    useEffect(() => {
        const load = (): void => void browser.storage[area].get(null).then(setItems);
        const onChanged = (_: unknown, changedArea: string): void => {
            if (changedArea === area) load();
        };

        setItems(null);
        load();
        browser.storage.onChanged.addListener(onChanged);
        return () => browser.storage.onChanged.removeListener(onChanged);
    }, [area]);

    return items;
};

const StorageEntry = ({name, value, onDelete}: { name: string; value: unknown; onDelete: () => void }) => {
    const [open, setOpen] = useState(false);

    return (
        <Box py="2" style={{borderTop: "1px solid var(--gray-a4)"}}>
            <Flex align="center" gap="2">
                <IconButton size="1" variant="ghost" color="gray" aria-label={open ? "접기" : "펼치기"} onClick={() => setOpen(!open)}>
                    {open ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                </IconButton>
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
            {open && (
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
            )}
        </Box>
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
                <SegmentedControl.Root value={area} onValueChange={(value) => setArea(value as Area)}>
                    {(Object.keys(AREA_NAMES) as Area[]).map((key) => (
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

const DatabaseSection = ({notify}: { notify: (message: string) => void }) => {
    const [db, setDb] = useState<StoredDB | null>(null);
    const [ip, setIp] = useState("");
    const [, rerender] = useState(0);
    const fileInput = useRef<HTMLInputElement>(null);

    useEffect(() => {
        void dbStorage.getValue().then(setDb);
        // 조회 테스트는 콘텐츠 스크립트와 같은 경로(ipInfoOf)로 — 저장소가 바뀌면 다시 그린다
        void initDatabase().then(() => rerender((count) => count + 1));
        return dbStorage.watch(setDb);
    }, []);

    const loadFile = async (file: File): Promise<void> => {
        try {
            const next = compactIpData(JSON.parse(await file.text()) as RawIpData);
            await dbStorage.setValue({...(await dbStorage.getValue()), version: "local", lastUpdate: Date.now(), ip: next});
            notify("IP 데이터를 파일에서 불러왔습니다. 다음 자동 갱신 때 서버 데이터로 바뀝니다.");
        } catch (error) {
            notify(`IP 데이터를 불러오는 데 실패했습니다. ${error instanceof Error ? error.message : ""}`);
        }
    };

    const info = ip.trim() ? ipInfoOf(ip.trim()) : undefined;
    const banCount = Object.values(db?.ban ?? {}).reduce((sum, uids) => sum + uids.length, 0);

    return (
        <Section
            title="IP/밴 데이터베이스"
            actions={
                <>
                    <input ref={fileInput} type="file" accept=".json,application/json" hidden
                           onChange={(event) => {
                               const file = event.target.files?.[0];
                               event.target.value = "";
                               if (file) void loadFile(file);
                           }}/>
                    <Button variant="soft" color="gray" onClick={() => fileInput.current?.click()}>
                        <FileJson size={14}/> IP 파일 불러오기
                    </Button>
                    <Button variant="soft" color="red"
                            onClick={() => void dbStorage.setValue({version: "", lastUpdate: 0, ip: null, ban: {}})}>
                        <Trash2 size={14}/> 비우기
                    </Button>
                </>
            }
        >
            <DataList.Root size="2" mb="4">
                <DataList.Item>
                    <DataList.Label>버전</DataList.Label>
                    <DataList.Value>{db?.version || "없음"}</DataList.Value>
                </DataList.Item>
                <DataList.Item>
                    <DataList.Label>마지막 갱신</DataList.Label>
                    <DataList.Value>{formatTime(db?.lastUpdate ?? 0)}</DataList.Value>
                </DataList.Item>
                <DataList.Item>
                    <DataList.Label>IP</DataList.Label>
                    <DataList.Value>
                        {!db?.ip ? "없음" : typeof db.ip.table === "string" ? `조직 ${db.ip.orgs.length} · 국가 ${db.ip.countries.length} · 후보 ${db.ip.meta.length / 3} · 목록 ${db.ip.lists.length} · ${formatBytes(byteSize(db.ip))}` : "예전 형식 (다음 갱신 때 바뀜)"}
                    </DataList.Value>
                </DataList.Item>
                <DataList.Item>
                    <DataList.Label>밴</DataList.Label>
                    <DataList.Value>{`사유 ${Object.keys(db?.ban ?? {}).length} · 유저 ${banCount}`}</DataList.Value>
                </DataList.Item>
            </DataList.Root>

            <TextField.Root placeholder="IP 조회 (예: 175.223)" value={ip} onChange={(event) => setIp(event.target.value)}/>
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

const ToolsSection = ({notify, onHide}: { notify: (message: string) => void; onHide: () => void }) => {
    const clearModuleData = async (): Promise<void> => {
        const keys = Object.keys(await browser.storage.local.get(null)).filter((key) => /^refresher:module:.+:data$/.test(key));
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
                    <Button variant="soft" color="gray" onClick={onHide}>
                        <EyeOff size={14}/> 개발자 탭 숨기기
                    </Button>
                )}
            </Flex>
        </Section>
    );
};

export function DevTab({onHide}: { onHide: () => void }) {
    const [notice, setNotice] = useState<string | null>(null);

    return (
        <Box>
            <StorageSection/>
            <DatabaseSection notify={setNotice}/>
            <ToolsSection notify={setNotice} onHide={onHide}/>

            <Notice message={notice} onClose={() => setNotice(null)}/>
        </Box>
    );
}
