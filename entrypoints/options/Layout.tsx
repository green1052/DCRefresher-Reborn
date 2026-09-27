import {Badge, Box, Button, Card, Dialog, Flex, Heading, IconButton, Table, Tabs, Text, TextArea, TextField, Tooltip} from "@radix-ui/themes";
import {Download, Plus, Search, Trash2, Upload} from "lucide-react";
import {type ReactNode, useDeferredValue, useEffect, useState} from "react";
import type {WxtStorageItem} from "wxt/utils/storage";

import {ConfirmDialog, DialogActions} from "@/components/ConfirmDialog";
import {friendlyMessage, SAVE_FAILED} from "@/utils/error";
import {isRecord} from "@/utils/record";

import {notify} from "./optionsStore";

/** 저장소 항목 하나의 값. 배경·다른 탭에서 바뀌어도 따라가고, 읽기 전에는 fallback이다 */
export const useStorageItem = <T, >(item: WxtStorageItem<T, {}>): T => {
    const [value, setValue] = useState(item.fallback);

    useEffect(() => {
        item.getValue().then(setValue, console.error);
        return item.watch(setValue);
    }, [item]);

    return value;
};

/** 저장 시각 표시 (0이면 기록 없음) */
export const formatTime = (time: number): string => (time === 0 ? "기록 없음" : new Date(time).toLocaleString("ko-KR"));

/** JSON으로 저장했을 때의 크기 (바이트) */
export const byteSize = (value: unknown): number => new Blob([JSON.stringify(value)]).size;

export const formatBytes = (bytes: number): string =>
    bytes < 1024 ? `${bytes}B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)}KB` : `${(bytes / 1024 / 1024).toFixed(2)}MB`;

/** 옵션 페이지 섹션 카드. 스타일은 Radix Themes prop만 쓴다 */
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

export const Empty = ({children}: { children: ReactNode }) => (
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
export const ImportDialog = ({title, desc = "내보낸 JSON 데이터를 붙여 넣어 주세요.", onClose, onSubmit}: {
    title: string;
    desc?: ReactNode;
    onClose: () => void;
    onSubmit: (text: string) => Promise<void>;
}) => {
    const [text, setText] = useState("");
    const [busy, setBusy] = useState(false);

    const submit = async (): Promise<void> => {
        setBusy(true);
        try {
            await onSubmit(text);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog.Root open onOpenChange={(next) => !next && onClose()}>
            <Dialog.Content maxWidth="520px">
                <Dialog.Title>{title}</Dialog.Title>
                <Dialog.Description size="2" mb="3">
                    {desc}
                </Dialog.Description>

                <TextArea placeholder="JSON 데이터" value={text} rows={8} autoFocus
                          onChange={(ev) => setText(ev.target.value)}/>

                <DialogActions>
                    <Button loading={busy} disabled={!text.trim()} onClick={() => void submit()}>가져오기</Button>
                </DialogActions>
            </Dialog.Content>
        </Dialog.Root>
    );
};

/** 받침이 있으면 "을", 없으면 "를" */
const objectParticle = (word: string): string => ((word.charCodeAt(word.length - 1) - 0xac00) % 28 > 0 ? "을" : "를");

/** 표 한 줄. 줄을 누르거나 Enter/Space로 편집하고, 휴지통 버튼으로 삭제한다 */
export const ListRow = ({head, info, onEdit, onRemove}: {
    head: ReactNode;
    info: ReactNode;
    onEdit: () => void;
    onRemove: () => void;
}) => (
    <Table.Row align="center" style={{cursor: "pointer"}} tabIndex={0} onClick={onEdit}
               onKeyDown={(ev) => {
                   // 삭제 버튼에서 누른 Enter/Space는 버튼 몫이다. 줄까지 올라와 편집이 같이 열리지 않게 한다
                   if (ev.target !== ev.currentTarget || (ev.key !== "Enter" && ev.key !== " ")) return;
                   ev.preventDefault();
                   onEdit();
               }}>
        <Table.RowHeaderCell>{head}</Table.RowHeaderCell>
        <Table.Cell>{info}</Table.Cell>
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
                                                  row
                                              }: {
    types: readonly T[];
    names: Record<T, string>;
    /** "차단 목록", "메모" 등. 알림·확인 문구에 쓴다 */
    label: string;
    columns: [string, string];
    emptyText: (type: T) => string;
    exportData: () => unknown;
    /** 붙여넣은 JSON에서 가져온 종류 수를 돌려준다. 0이면 다른 데이터를 붙여넣은 것으로 보고 실패로 알린다 */
    importData: (parsed: Record<string, unknown>) => Promise<number>;
    onClear: (type: T) => Promise<void>;
    onAdd: (type: T) => void;
    /** 목록 위 왼쪽에 둘 도구(차단 탭의 기본 차단 모드) */
    toolbar?: (type: T) => ReactNode;
    /** 저장된 순서(오래된 것부터) 그대로 준다. 표시할 때 뒤집는다 */
    items: (type: T) => readonly I[];
    /** 검색 대상 글자 (내용/유저/메모/갤러리 등) */
    searchText: (item: I) => (string | undefined)[];
    row: (type: T, item: I) => ReactNode;
}) => {
    // 모든 탭이 같은 검색어를 쓴다. 탭 배지에 탭마다 걸린 개수가 보여 다른 탭에 있는지도 알 수 있다
    const [query, setQuery] = useState("");
    // 입력칸은 바로 바꾸고 목록은 뒤따라 그린다. 수천 줄을 거르고 그리는 동안 글자 입력이 막히지 않게 한다
    const needle = useDeferredValue(query).trim().toLowerCase();
    // 새 항목은 배열/객체 끝에 붙으므로 뒤집어 최신순으로 보여 준다(저장 순서는 그대로).
    // 종류마다 한 번만 걸러 탭 배지와 표가 같이 쓴다.
    const shown = new Map(types.map((type) => [
        type,
        items(type).filter((item) => !needle || searchText(item).some((text) => text?.toLowerCase().includes(needle))).reverse()
    ]));

    const [clearConfirm, setClearConfirm] = useState<T | null>(null);
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

    const submitImport = async (text: string): Promise<void> => {
        let data: unknown;
        try {
            data = JSON.parse(text);
        } catch (e) {
            notify(`${object} 가져오지 못했습니다. ${friendlyMessage(e)}`);
            return;
        }

        try {
            if (isRecord(data) && (await importData(data)) > 0) {
                setImportOpen(false);
                notify(`${object} 가져왔습니다.`);
            } else {
                // 데이터 탭의 전체 내보내기는 저장소 키(refresher:…)로 되어 있다
                notify(isRecord(data) && Object.keys(data).some((key) => key.startsWith("refresher:"))
                    ? "전체 데이터는 데이터 탭에서 가져와 주세요."
                    : `${label} 데이터가 아닙니다. 이 탭에서 내보낸 JSON을 붙여 넣어 주세요.`);
            }
        } catch {
            // 종류마다 따로 쓰므로 앞 종류는 이미 들어갔을 수 있다. 실패한 종류는 스토어가 되돌린다
            notify(SAVE_FAILED);
        }
    };

    return (
        <Card size="3">
            <Tabs.Root defaultValue={types[0]}>
                <Flex align="end" gap="3">
                    <Tabs.List style={{flex: 1, flexWrap: "wrap"}}>
                        {types.map((type) => {
                            const total = items(type).length;
                            return (
                                <Tabs.Trigger key={type} value={type}>
                                    {names[type]}
                                    {total > 0 && (
                                        <Badge ml="1" size="1" variant="soft" color={needle ? "blue" : "gray"} radius="full">
                                            {needle ? `${shown.get(type)!.length}/${total}` : total}
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
                    const total = items(type).length;
                    const list = shown.get(type)!;
                    return (
                        <Tabs.Content key={type} value={type} className="refresher-tab-enter">
                            <Flex justify="between" align="center" gap="3" wrap="wrap" py="4">
                                {toolbar?.(type)}
                                <Flex gap="2" ml="auto" wrap="wrap">
                                    <TextField.Root type="search" placeholder="검색" aria-label={`${label} 검색`} value={query}
                                                    style={{width: 180}} onChange={(ev) => setQuery(ev.target.value)}>
                                        <TextField.Slot>
                                            <Search size={14}/>
                                        </TextField.Slot>
                                    </TextField.Root>
                                    {/* 검색 중에도 걸러진 것만이 아니라 이 종류 전부를 지우므로 확인 문구에 전체 개수를 적는다 */}
                                    <Tooltip content="전체 삭제">
                                        <IconButton variant="soft" color="red" aria-label="전체 삭제" disabled={total === 0}
                                                    onClick={() => setClearConfirm(type)}>
                                            <Trash2 size={16}/>
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip content="추가">
                                        <IconButton aria-label="추가" onClick={() => {
                                            // 검색어에 안 맞는 새 항목이 바로 숨어 추가가 안 된 것처럼 보이지 않게 검색어를 비운다
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
                                <Empty>"{query.trim()}" 검색 결과 없음</Empty>
                            ) : (
                                <Table.Root variant="surface">
                                    <Table.Header>
                                        <Table.Row>
                                            <Table.ColumnHeaderCell>{columns[0]}</Table.ColumnHeaderCell>
                                            <Table.ColumnHeaderCell>{columns[1]}</Table.ColumnHeaderCell>
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

            {importOpen && <ImportDialog title={`${label} 가져오기`} onClose={() => setImportOpen(false)} onSubmit={submitImport}/>}
        </Card>
    );
};
