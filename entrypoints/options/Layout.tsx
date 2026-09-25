import {Badge, Box, Button, Card, Dialog, Flex, Heading, IconButton, Table, Tabs, Text, TextArea, Tooltip} from "@radix-ui/themes";
import {Download, Plus, Trash2, Upload, X} from "lucide-react";
import {type ReactNode, useState} from "react";

import {ConfirmDialog, DialogActions, Notice} from "@/components/ConfirmDialog";

/** 저장 시각 표시 (0이면 기록 없음) */
export const formatTime = (time: number): string => (time === 0 ? "기록 없음" : new Date(time).toLocaleString("ko-KR"));

/** 옵션 페이지 전용 레이아웃 — 스타일은 Radix Themes 프롭만 사용 */
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
 * 내보낸 JSON을 붙여넣는 가져오기 다이얼로그 (차단/메모/데이터 공용).
 * 열 때만 마운트한다 — 닫으면 입력이 초기화되고, 실패해 열려 있으면 붙여넣은 텍스트가 남는다
 */
export const ImportDialog = ({title, onClose, onSubmit}: {
    title: string;
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
                    내보낸 JSON 데이터를 붙여넣어주세요.
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

/** 표 한 줄 — 누르면 편집, X는 삭제 */
export const ListRow = ({head, info, onEdit, onRemove}: {
    head: ReactNode;
    info: ReactNode;
    onEdit: () => void;
    onRemove: () => void;
}) => (
    <Table.Row align="center" style={{cursor: "pointer"}} onClick={onEdit}>
        <Table.RowHeaderCell>{head}</Table.RowHeaderCell>
        <Table.Cell>{info}</Table.Cell>
        <Table.Cell>
            <IconButton variant="ghost" color="gray" size="1" aria-label="삭제"
                        onClick={(ev) => {
                            ev.stopPropagation();
                            onRemove();
                        }}>
                <X size={12}/>
            </IconButton>
        </Table.Cell>
    </Table.Row>
);

/** 차단/메모 탭 공용 틀 — 종류별 탭, 클립보드 내보내기/가져오기, 전체 삭제/추가, 빈 목록 안내, 표 머리. 줄(ListRow)은 rows가 그린다 */
export const ListTabs = <T extends string>({
                                               types,
                                               names,
                                               counts,
                                               label,
                                               columns,
                                               emptyText,
                                               exportData,
                                               importData,
                                               onClear,
                                               onAdd,
                                               toolbar,
                                               rows
                                           }: {
    types: readonly T[];
    names: Record<T, string>;
    counts: Record<T, number>;
    /** "차단 목록", "메모" — 알림·확인 문구에 쓴다 */
    label: string;
    columns: [string, string];
    emptyText: (type: T) => string;
    exportData: () => unknown;
    /** 붙여넣은 JSON에서 가져온 종류 수 — 0이면 다른 데이터를 붙여넣은 것으로 보고 실패로 알린다 */
    importData: (parsed: Record<string, unknown>) => Promise<number>;
    onClear: (type: T) => Promise<void>;
    onAdd: (type: T) => void;
    /** 탭 머리 왼쪽 (차단의 기본 차단 모드) */
    toolbar?: (type: T) => ReactNode;
    rows: (type: T) => ReactNode;
}) => {
    const [clearConfirm, setClearConfirm] = useState<T | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [importOpen, setImportOpen] = useState(false);
    const object = label + objectParticle(label);

    const exportList = async (): Promise<void> => {
        try {
            await navigator.clipboard.writeText(JSON.stringify(exportData()));
            setNotice(`${object} 클립보드로 내보냈습니다.`);
        } catch {
            setNotice(`${object} 내보내는 데 실패했습니다.`);
        }
    };

    const submitImport = async (text: string): Promise<void> => {
        try {
            if ((await importData(JSON.parse(text) as Record<string, unknown>)) === 0) throw new Error();
            setImportOpen(false);
            setNotice(`${object} 가져왔습니다.`);
        } catch {
            setNotice(`${object} 가져오는 데 실패했습니다.`);
        }
    };

    return (
        <Card size="3">
            <Tabs.Root defaultValue={types[0]}>
                <Flex align="end" gap="3">
                    <Tabs.List style={{flex: 1, flexWrap: "wrap"}}>
                        {types.map((type) => (
                            <Tabs.Trigger key={type} value={type}>
                                {names[type]}
                                {counts[type] > 0 && (
                                    <Badge ml="1" size="1" variant="soft" color="gray" radius="full">{counts[type]}</Badge>
                                )}
                            </Tabs.Trigger>
                        ))}
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

                {types.map((type) => (
                    <Tabs.Content key={type} value={type}>
                        <Flex justify="between" align="center" gap="3" wrap="wrap" py="4">
                            {toolbar?.(type)}
                            <Flex gap="2" ml="auto">
                                <Button variant="soft" color="red" disabled={counts[type] === 0} onClick={() => setClearConfirm(type)}>
                                    <Trash2 size={14}/> 전체 삭제
                                </Button>
                                <Button onClick={() => onAdd(type)}>
                                    <Plus size={14}/> 추가
                                </Button>
                            </Flex>
                        </Flex>

                        {counts[type] === 0 ? (
                            <Empty>{emptyText(type)}</Empty>
                        ) : (
                            <Table.Root variant="surface">
                                <Table.Header>
                                    <Table.Row>
                                        <Table.ColumnHeaderCell>{columns[0]}</Table.ColumnHeaderCell>
                                        <Table.ColumnHeaderCell>{columns[1]}</Table.ColumnHeaderCell>
                                        <Table.ColumnHeaderCell width="48px"/>
                                    </Table.Row>
                                </Table.Header>
                                <Table.Body>{rows(type)}</Table.Body>
                            </Table.Root>
                        )}
                    </Tabs.Content>
                ))}
            </Tabs.Root>

            {clearConfirm && (
                <ConfirmDialog
                    title={`${names[clearConfirm]} ${object} 모두 삭제할까요?`}
                    confirmLabel="삭제"
                    danger
                    onConfirm={() => {
                        void onClear(clearConfirm);
                        setClearConfirm(null);
                    }}
                    onClose={() => setClearConfirm(null)}
                />
            )}

            <Notice message={notice} onClose={() => setNotice(null)}/>

            {importOpen && <ImportDialog title={`${label} 가져오기`} onClose={() => setImportOpen(false)} onSubmit={submitImport}/>}
        </Card>
    );
};
