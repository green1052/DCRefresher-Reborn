import {Badge, Box, Button, Card, Dialog, Flex, Heading, IconButton, Reset, Table, Tabs, Text, TextArea, TextField, Tooltip} from "@radix-ui/themes";
import {Download, Plus, Search, Trash2, Upload} from "lucide-react";
import {type ReactNode, useDeferredValue, useEffect, useRef, useState} from "react";
import {storage, type WxtStorageItem} from "wxt/utils/storage";

import {ConfirmDialog, DialogActions} from "@/components/ConfirmDialog";
import {RefresherSelect} from "@/components/RefresherSelect";
import {sendMessage} from "@/core/messaging/protocol";
import {USAGE_KEY, type UsageKind} from "@/core/usage";
import {useOpenerFocus} from "@/components/useOpenerFocus";
import {friendlyMessage, SAVE_FAILED} from "@/utils/error";
import {isRecord} from "@/utils/record";

import {notify} from "./optionsStore";

/** 저장소 항목 하나의 값. 배경·다른 탭에서 바뀌어도 따라가고, 읽기 전에는 fallback이다. */
export const useStorageItem = <T, >(item: WxtStorageItem<T, {}>): T => {
    const [value, setValue] = useState(item.fallback);

    useEffect(() => {
        // 읽기보다 변경 알림이 먼저 오면 늦게 온 읽기 결과가 새 값을 덮지 않게 한다.
        let watched = false;
        item.getValue().then((next) => {
            if (!watched) setValue(next);
        }, console.error);
        return item.watch((next) => {
            watched = true;
            setValue(next);
        });
    }, [item]);

    return value;
};

/** 저장 시각 표시 (0이면 기록 없음). */
export const formatTime = (time: number): string => (time === 0 ? "기록 없음" : new Date(time).toLocaleString("ko-KR"));

/** JSON으로 저장했을 때의 크기 (바이트). */
export const byteSize = (value: unknown): number => new Blob([JSON.stringify(value)]).size;

export const formatBytes = (bytes: number): string =>
    bytes < 1024 ? `${bytes}B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)}KB` : `${(bytes / 1024 / 1024).toFixed(2)}MB`;

const DAY = 24 * 60 * 60 * 1000;

/** 마지막으로 쓰인 시각 표시 ("오늘", "3일 전"). */
const formatUsed = (time: number | undefined): string => {
    if (time === undefined) return "—";
    const days = Math.floor((Date.now() - time) / DAY);
    return days < 1 ? "오늘" : `${days}일 전`;
};

/**
 * 차단 항목·메모가 이 기기에서 마지막으로 쓰인 시각 (core/usage). 목록이 바뀌면 기록을 목록에 맞추고, 콘텐츠 스크립트가 적으면 따라간다.
 * ids는 목록이 바뀔 때만 새로 만들어야 한다 (렌더마다 새 배열이면 매번 저장소를 읽는다).
 */
export const useUsage = (kind: UsageKind, ids: readonly string[]): Record<string, number> => {
    const [times, setTimes] = useState<Record<string, number>>({});

    useEffect(() => {
        // 기록이 바뀌지 않았으면 저장소 이벤트가 오지 않으므로 응답으로 채운다. 응답을 기다리는 동안 watch가 먼저 오면
        // (배경이 저장소에 쓰고 같은 값을 돌려준다) 그 새 값을 응답이 덮지 않게 버린다.
        let stale = false;
        sendMessage("refresher:syncUsage", {kind, ids: [...ids]}).then((next) => {
            if (!stale) setTimes(next);
        }, console.error);
        const unwatch = storage.watch<Record<UsageKind, Record<string, number>>>(USAGE_KEY, (next) => {
            stale = true;
            if (next) setTimes(next[kind] ?? {});
        });
        return () => {
            stale = true;
            unwatch();
        };
    }, [kind, ids]);

    return times;
};

/** 옵션 페이지 섹션 카드. 스타일은 Radix Themes prop만 쓴다. */
export const Section = ({title, desc, actions, children}: {
    title?: ReactNode;
    desc?: ReactNode;
    actions?: ReactNode;
    children?: ReactNode
}) => (
    <Card size="3" mb="4">
        {(title || desc || actions) && (
            <Flex justify="between" align="center" gap="4" wrap="wrap" mb={children ? "4" : "0"}>
                <Box minWidth="0">
                    {title && <Heading as="h2" size="4">{title}</Heading>}
                    {desc && <Text as="p" size="2" color="gray">{desc}</Text>}
                </Box>
                {actions && (
                    <Flex gap="2" align="center" ml="auto">
                        {actions}
                    </Flex>
                )}
            </Flex>
        )}
        {children}
    </Card>
);

const Empty = ({children}: { children: ReactNode }) => (
    <Box py="6">
        <Text as="p" size="2" color="gray" align="center">
            {children}
        </Text>
    </Box>
);

/**
 * 내보낸 JSON을 붙여넣는 가져오기 다이얼로그(차단/메모/데이터 공용).
 * 열 때만 마운트하므로 닫으면 입력이 초기화되고, 가져오기에 실패해 열려 있으면 붙여넣은 텍스트가 남는다.
 */
export const ImportDialog = ({title, desc = "내보낸 JSON 데이터를 붙여 넣어 주세요.", placeholder = "JSON 데이터", onClose, onSubmit}: {
    title: string;
    desc?: ReactNode;
    /** 입력칸 안내이자 이름. */
    placeholder?: string;
    onClose: () => void;
    /** 가져왔으면 알림 문구를 돌려준다. 실패는 직접 알리고 undefined를 돌려줘 다이얼로그를 열어 둔다. */
    onSubmit: (text: string) => Promise<string | undefined>;
}) => {
    const [text, setText] = useState("");
    const [busy, setBusy] = useState(false);
    const done = useRef<string>(undefined);
    const focus = useOpenerFocus();

    const submit = async (): Promise<void> => {
        setBusy(true);
        done.current = await onSubmit(text).finally(() => setBusy(false));
        if (done.current) onClose();
    };

    // 가져오는 중에는 닫지 않는다. 닫으면 가져오기는 끝나도 알림이 뜨지 않는다.
    return (
        <Dialog.Root open onOpenChange={(next) => !next && !busy && onClose()}>
            {/* 가져왔다는 알림은 포커스를 가져오기 버튼에 돌려준 뒤에 띄운다.
                먼저 띄우면 알림이 곧 사라질 이 다이얼로그의 버튼을 연 요소로 기억해, 알림을 닫을 때 포커스가 body로 떨어진다 */}
            <Dialog.Content maxWidth="520px" onCloseAutoFocus={(ev) => {
                focus.onCloseAutoFocus(ev);
                if (done.current) notify(done.current);
            }}>
                <Dialog.Title>{title}</Dialog.Title>
                <Dialog.Description size="2" mb="3">
                    {desc}
                </Dialog.Description>

                <TextArea placeholder={placeholder} aria-label={placeholder} value={text} rows={8} autoFocus
                          onChange={(ev) => setText(ev.target.value)}/>

                <DialogActions>
                    <Button loading={busy} disabled={!text.trim()} onClick={() => void submit()}>가져오기</Button>
                </DialogActions>
            </Dialog.Content>
        </Dialog.Root>
    );
};

/** 오래 안 쓰인 항목 거르기. 쓰인 시각은 이 기기에서 걸리거나(차단) 보인(메모) 때다. */
const UNUSED_OPTIONS = {"0": "사용 기록 전체", "30": "30일 넘게 안 쓰임", "90": "90일 넘게 안 쓰임", "180": "180일 넘게 안 쓰임"};

/** 받침이 있으면 "을", 없으면 "를" */
const objectParticle = (word: string): string => ((word.charCodeAt(word.length - 1) - 0xac00) % 28 > 0 ? "을" : "를");

/** 표 한 줄. 줄을 누르면 편집하고, 휴지통 버튼으로 삭제한다. */
export const ListRow = ({head, info, used, onEdit, onRemove}: {
    head: ReactNode;
    info: ReactNode;
    /** 마지막으로 쓰인 시각 (useUsage). */
    used?: number;
    onEdit: () => void;
    onRemove: () => void;
}) => (
    <Table.Row align="center" style={{cursor: "pointer"}} onClick={onEdit}>
        <Table.RowHeaderCell>
            {/* 줄(tr)은 버튼이 될 수 없어 키보드·스크린 리더에는 첫 칸을 편집 버튼으로 알린다.
                따로 onClick을 달지 않는다. 누르면(Enter/Space 포함) click이 줄로 올라가 편집이 열린다 */}
            <Reset>
                <button type="button" title="수정" className="refresher-row-edit">{head}</button>
            </Reset>
        </Table.RowHeaderCell>
        <Table.Cell>{info}</Table.Cell>
        <Table.Cell>
            <Text size="2" color="gray" wrap="nowrap">{formatUsed(used)}</Text>
        </Table.Cell>
        <Table.Cell justify="end">
            {/* ghost는 음수 여백으로 칸 밖에 걸쳐 줄 가운데에서 어긋나므로 여백을 없앤다.
                툴팁은 브라우저 기본(title)을 쓴다. 줄마다 Radix 툴팁을 달면 수천 줄 목록을 열거나 검색할 때마다 느려진다 */}
            <IconButton variant="ghost" color="red" size="1" aria-label="삭제" title="삭제" style={{margin: 0}}
                        onClick={(ev) => {
                            ev.stopPropagation();
                            onRemove();
                        }}>
                <Trash2 size={14}/>
            </IconButton>
        </Table.Cell>
    </Table.Row>
);

/**
 * 차단/메모 탭 공용 틀. 종류별 탭, 검색, 클립보드 내보내기/가져오기, 전체 삭제/추가, 빈 목록 안내, 표 머리를 그린다.
 * 줄(ListRow)은 row가 그린다.
 */
export const ListTabs = <T extends string, I>({
                                                  types,
                                                  names,
                                                  label,
                                                  columns,
                                                  emptyText,
                                                  exportData,
                                                  importData,
                                                  onClear,
                                                  onAdd,
                                                  toolbar,
                                                  items,
                                                  searchText,
                                                  galleryOf,
                                                  usedAt,
                                                  onRemoveMany,
                                                  row
                                              }: {
    types: readonly T[];
    names: Record<T, string>;
    /** "차단 목록", "메모" 등. 알림·확인 문구에 쓴다. */
    label: string;
    columns: [string, string];
    emptyText: (type: T) => string;
    exportData: () => unknown;
    /** 붙여넣은 JSON에서 가져온 종류 수를 돌려준다. 0이면 다른 데이터를 붙여넣은 것으로 보고 실패로 알린다. */
    importData: (parsed: Record<string, unknown>) => Promise<number>;
    onClear: (type: T) => Promise<void>;
    onAdd: (type: T) => void;
    /** 목록 위 왼쪽에 둘 도구(차단 탭의 기본 차단 모드). */
    toolbar: (type: T) => ReactNode;
    /** 저장된 순서(오래된 것부터) 그대로 준다. 표시할 때 뒤집는다. */
    items: (type: T) => readonly I[];
    /** 검색 대상 글자 (내용/유저/메모/갤러리 등). */
    searchText: (item: I) => (string | undefined)[];
    /** 갤러리 한정 항목의 갤러리 ID (없으면 모든 갤러리). 갤러리로 거를 때 쓴다. */
    galleryOf: (item: I) => string | undefined;
    /** 마지막으로 쓰인 시각 (useUsage). 오래 안 쓰인 항목을 거를 때 쓴다. */
    usedAt: (type: T, item: I) => number | undefined;
    /** 걸러 보이는 항목을 한꺼번에 지운다. */
    onRemoveMany: (type: T, items: readonly I[]) => Promise<void>;
    row: (type: T, item: I) => ReactNode;
}) => {
    // 모든 탭이 같은 검색어를 쓴다. 탭 배지에 탭마다 걸린 개수가 보여 다른 탭에 있는지도 알 수 있다.
    const [query, setQuery] = useState("");
    // 입력칸은 바로 바꾸고 목록은 뒤따라 그린다. 수천 줄을 거르고 그리는 동안 글자 입력이 막히지 않게 한다.
    const needle = useDeferredValue(query).trim().toLowerCase();
    // 갤러리 거르기: all(전체), common(모든 갤러리 항목), g:<ID>(그 갤러리 한정 항목). 검색어처럼 모든 탭이 같이 쓴다.
    const [gallery, setGallery] = useState("all");
    // 이만큼(일) 넘게 안 쓰인 항목만. 0이면 거르지 않는다.
    const [unusedDays, setUnusedDays] = useState("0");
    const galleries = [...new Set(types.flatMap((type) => items(type).map(galleryOf)).filter((id): id is string => Boolean(id)))].sort();
    const galleryOptions: Record<string, string> = {all: "모든 항목", common: "갤러리 공통", ...Object.fromEntries(galleries.map((id) => [`g:${id}`, id]))};
    // 고르던 갤러리의 항목을 다 지우면 선택지에서 빠지므로 전체로 돌린다.
    const galleryFilter = gallery in galleryOptions ? gallery : "all";
    const cutoff = Number(unusedDays) > 0 ? Date.now() - Number(unusedDays) * 24 * 60 * 60 * 1000 : 0;
    const filtering = Boolean(needle) || galleryFilter !== "all" || cutoff > 0;

    const visible = (type: T, item: I): boolean => {
        if (needle && !searchText(item).some((text) => text?.toLowerCase().includes(needle))) return false;
        if (galleryFilter !== "all" && (galleryOf(item) ?? "") !== (galleryFilter === "common" ? "" : galleryFilter.slice(2))) return false;
        // 기록이 아직 없으면(옵션이 맞추기 전) 오래된 것으로 보지 않는다.
        return !cutoff || (usedAt(type, item) ?? Date.now()) < cutoff;
    };
    // 새 항목은 배열/객체 끝에 붙으므로 뒤집어 최신순으로 보여 준다(저장 순서는 그대로).
    // 종류마다 한 번만 걸러 탭 배지와 표가 같이 쓴다. total은 거르기 전 개수다.
    const shown = new Map(types.map((type) => {
        const all = items(type);
        return [type, {total: all.length, list: all.filter((item) => visible(type, item)).reverse()}];
    }));

    const [clearConfirm, setClearConfirm] = useState<T | null>(null);
    const [removeShownConfirm, setRemoveShownConfirm] = useState<T | null>(null);
    const [importOpen, setImportOpen] = useState(false);
    const object = label + objectParticle(label);

    const exportList = async (): Promise<void> => {
        try {
            await navigator.clipboard.writeText(JSON.stringify(exportData()));
            notify(`${object} 클립보드로 내보냈습니다.`);
        } catch {
            notify(`${object} 내보내지 못했습니다.`);
        }
    };

    const submitImport = async (text: string): Promise<string | undefined> => {
        let data: unknown;
        try {
            data = JSON.parse(text);
        } catch (e) {
            notify(`${object} 가져오지 못했습니다. ${friendlyMessage(e)}`);
            return;
        }

        try {
            if (isRecord(data) && (await importData(data)) > 0) return `${object} 가져왔습니다.`;
            // 데이터 탭의 전체 내보내기는 저장소 키(refresher:…)로 되어 있다.
            notify(isRecord(data) && Object.keys(data).some((key) => key.startsWith("refresher:"))
                ? "전체 데이터는 데이터 탭에서 가져와 주세요."
                : `${label} 데이터가 아닙니다. 이 탭에서 내보낸 JSON을 붙여 넣어 주세요.`);
        } catch {
            // 종류마다 따로 쓰므로 앞 종류는 이미 들어갔을 수 있다. 실패한 종류는 스토어가 되돌린다.
            notify(SAVE_FAILED);
        }
    };

    return (
        <Card size="3">
            <Tabs.Root defaultValue={types[0]}>
                <Flex align="end" gap="3">
                    <Tabs.List style={{flex: 1, flexWrap: "wrap"}}>
                        {types.map((type) => {
                            const {total, list} = shown.get(type)!;
                            return (
                                <Tabs.Trigger key={type} value={type}>
                                    {names[type]}
                                    {total > 0 && (
                                        <Badge ml="1" size="1" variant="soft" color={filtering ? "blue" : "gray"} radius="full">
                                            {filtering ? `${list.length}/${total}` : total}
                                        </Badge>
                                    )}
                                </Tabs.Trigger>
                            );
                        })}
                    </Tabs.List>
                    <Flex gap="3" pb="2">
                        <Tooltip content="클립보드로 내보내기">
                            <IconButton variant="ghost" color="gray" aria-label="내보내기" onClick={() => void exportList()}>
                                <Download size={16}/>
                            </IconButton>
                        </Tooltip>
                        <Tooltip content="가져오기">
                            <IconButton variant="ghost" color="gray" aria-label="가져오기" onClick={() => setImportOpen(true)}>
                                <Upload size={16}/>
                            </IconButton>
                        </Tooltip>
                    </Flex>
                </Flex>

                {types.map((type) => {
                    const {total, list} = shown.get(type)!;
                    return (
                        <Tabs.Content key={type} value={type} className="refresher-tab-enter">
                            <Flex align="center" gap="2" wrap="wrap" pt="4">
                                <RefresherSelect value={galleryFilter} options={galleryOptions} aria-label="갤러리" onChange={setGallery}/>
                                <RefresherSelect value={unusedDays} options={UNUSED_OPTIONS} aria-label="마지막 사용" onChange={setUnusedDays}/>
                                {filtering && list.length > 0 && (
                                    <Button variant="soft" color="red" onClick={() => setRemoveShownConfirm(type)}>
                                        <Trash2 size={14}/> 보이는 {list.length}개 삭제
                                    </Button>
                                )}
                            </Flex>
                            <Flex justify="between" align="center" gap="3" wrap="wrap" py="4">
                                {toolbar(type)}
                                <Flex gap="2" ml="auto" wrap="wrap">
                                    <TextField.Root type="search" placeholder="검색" aria-label={`${label} 검색`} value={query}
                                                    style={{width: 180}} onChange={(ev) => setQuery(ev.target.value)}>
                                        <TextField.Slot>
                                            <Search size={14}/>
                                        </TextField.Slot>
                                    </TextField.Root>
                                    {/* 검색 중에도 걸러진 것만이 아니라 이 종류 전부를 지우므로 확인 문구에 전체 개수를 적는다. */}
                                    <Tooltip content="전체 삭제">
                                        <IconButton variant="soft" color="red" aria-label="전체 삭제" disabled={total === 0}
                                                    onClick={() => setClearConfirm(type)}>
                                            <Trash2 size={16}/>
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip content="추가">
                                        <IconButton aria-label="추가" onClick={() => {
                                            // 검색어에 안 맞는 새 항목이 바로 숨어 추가가 안 된 것처럼 보이지 않게 검색어를 비운다.
                                            setQuery("");
                                            onAdd(type);
                                        }}>
                                            <Plus size={16}/>
                                        </IconButton>
                                    </Tooltip>
                                </Flex>
                            </Flex>

                            {total === 0 ? (
                                <Empty>{emptyText(type)}</Empty>
                            ) : list.length === 0 ? (
                                <Empty>{needle ? `"${query.trim()}" 검색 결과 없음` : "조건에 맞는 항목 없음"}</Empty>
                            ) : (
                                <Table.Root variant="surface">
                                    <Table.Header>
                                        <Table.Row>
                                            <Table.ColumnHeaderCell>{columns[0]}</Table.ColumnHeaderCell>
                                            <Table.ColumnHeaderCell>{columns[1]}</Table.ColumnHeaderCell>
                                            <Table.ColumnHeaderCell title="이 기기에서 마지막으로 걸리거나 보인 때">최근 사용</Table.ColumnHeaderCell>
                                            <Table.ColumnHeaderCell width="48px"/>
                                        </Table.Row>
                                    </Table.Header>
                                    <Table.Body>{list.map((item) => row(type, item))}</Table.Body>
                                </Table.Root>
                            )}
                        </Tabs.Content>
                    );
                })}
            </Tabs.Root>

            {clearConfirm && (
                <ConfirmDialog
                    title={`${names[clearConfirm]} ${object} 모두(${items(clearConfirm).length}개) 삭제할까요?`}
                    confirmLabel="삭제"
                    danger
                    onConfirm={() => {
                        onClear(clearConfirm).catch(() => notify(`${object} 삭제하지 못했습니다.`));
                        setClearConfirm(null);
                    }}
                    onClose={() => setClearConfirm(null)}
                />
            )}

            {removeShownConfirm && (
                <ConfirmDialog
                    title={`보이는 ${names[removeShownConfirm]} ${object} ${shown.get(removeShownConfirm)!.list.length}개 삭제할까요?`}
                    confirmLabel="삭제"
                    danger
                    onConfirm={() => {
                        onRemoveMany(removeShownConfirm, shown.get(removeShownConfirm)!.list).catch(() => notify(`${object} 삭제하지 못했습니다.`));
                        setRemoveShownConfirm(null);
                    }}
                    onClose={() => setRemoveShownConfirm(null)}
                />
            )}

            {importOpen && <ImportDialog title={`${label} 가져오기`} onClose={() => setImportOpen(false)} onSubmit={submitImport}/>}
        </Card>
    );
};
