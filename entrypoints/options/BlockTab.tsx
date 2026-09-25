import {Badge, Button, Card, Flex, IconButton, Table, Tabs, Text, Tooltip} from "@radix-ui/themes";
import {Download, Plus, Trash2, Upload, X} from "lucide-react";
import {useState} from "react";

import {BlockDialog} from "@/components/BlockDialog";
import {ConfirmDialog} from "@/components/ConfirmDialog";
import {RefresherSelect} from "@/components/RefresherSelect";
import {BLOCK_TYPES, DETECT_MODE_NAMES, TYPE_NAMES} from "@/core/storage/items";
import type {BlockEntry, BlockType, DetectMode} from "@/core/storage/types";
import {composeExtra} from "@/features/block/request";
import {type BlockInputFields, normalizeBlockList, useBlocksStore} from "@/stores/blocks";

import {Empty, ImportDialog} from "./Layout";

/** 디시콘 이미지 (묶음 정규식이면 첫 코드 — 디시콘이 하나뿐인 묶음은 "^(code)$") */
const dcconImage = (entry: BlockEntry): string => {
    const code = entry.isRegex ? (entry.content.match(/^\^\((\w+)[|)]/)?.[1] ?? entry.content) : entry.content;
    return `https://image.dcinside.com/dccon.php?no=${code}`;
};

/** 정보 칸 — 플래그는 필드에서 만들고, 예전 항목처럼 extra가 플래그 문자열이면 두 번 쓰지 않는다 */
const entryInfo = (entry: BlockEntry): string => {
    const flags = composeExtra(entry, DETECT_MODE_NAMES);
    return [flags, entry.extra !== flags ? entry.extra : null].filter(Boolean).join(" · ") || "—";
};

export function BlockTab() {
    const entries = useBlocksStore((state) => state.entries);
    const defaults = useBlocksStore((state) => state.defaults);
    const addEntry = useBlocksStore((state) => state.addEntry);
    const updateEntry = useBlocksStore((state) => state.updateEntry);
    const removeEntry = useBlocksStore((state) => state.removeEntry);
    const clearType = useBlocksStore((state) => state.clearType);
    const setDefault = useBlocksStore((state) => state.setDefault);
    const setEntries = useBlocksStore((state) => state.setEntries);

    const [dialog, setDialog] = useState<{ type: BlockType; initial: BlockEntry | null } | null>(null);
    const [clearConfirm, setClearConfirm] = useState<BlockType | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [importOpen, setImportOpen] = useState(false);

    const exportBlocks = async (): Promise<void> => {
        try {
            await navigator.clipboard.writeText(JSON.stringify(entries));
            setNotice("차단 목록을 클립보드로 내보냈습니다.");
        } catch {
            setNotice("차단 목록을 내보내는 데 실패했습니다.");
        }
    };

    const submitImport = async (text: string): Promise<void> => {
        try {
            const parsed = JSON.parse(text) as Record<string, unknown>;
            const types = BLOCK_TYPES.filter((type) => Array.isArray(parsed[type]));
            // 차단 목록이 하나도 없으면 다른 데이터(메모/설정 내보내기)를 붙여넣은 것
            if (types.length === 0) throw new Error();
            for (const type of types) await setEntries(type, normalizeBlockList(parsed[type]));
            setImportOpen(false);
            setNotice("차단 목록을 가져왔습니다.");
        } catch {
            setNotice("차단 목록을 가져오는 데 실패했습니다.");
        }
    };

    const handleSubmit = async (fields: BlockInputFields): Promise<void> => {
        if (!dialog) return;

        if (dialog.initial) await updateEntry(dialog.type, dialog.initial.id, fields);
        else await addEntry(dialog.type, fields);

        setDialog(null);
    };

    return (
        <Card size="3">
            <Tabs.Root defaultValue={BLOCK_TYPES[0]}>
                <Flex align="end" gap="3">
                    <Tabs.List style={{flex: 1, flexWrap: "wrap"}}>
                        {BLOCK_TYPES.map((type) => (
                            <Tabs.Trigger key={type} value={type}>
                                {TYPE_NAMES[type]}
                                {entries[type].length > 0 && (
                                    <Badge ml="1" size="1" variant="soft" color="gray" radius="full">
                                        {entries[type].length}
                                    </Badge>
                                )}
                            </Tabs.Trigger>
                        ))}
                    </Tabs.List>
                    <Flex gap="3" pb="2">
                        <Tooltip content="클립보드로 내보내기">
                            <IconButton variant="ghost" color="gray" aria-label="내보내기"
                                        onClick={() => void exportBlocks()}>
                                <Download size={16}/>
                            </IconButton>
                        </Tooltip>
                        <Tooltip content="가져오기">
                            <IconButton variant="ghost" color="gray" aria-label="가져오기"
                                        onClick={() => setImportOpen(true)}>
                                <Upload size={16}/>
                            </IconButton>
                        </Tooltip>
                    </Flex>
                </Flex>

                {BLOCK_TYPES.map((type) => {
                    const list = entries[type];

                    return (
                        <Tabs.Content key={type} value={type}>
                            <Flex justify="between" align="center" gap="3" wrap="wrap" py="4">
                                <Flex align="center" gap="2">
                                    <Text size="2" color="gray">기본 차단 모드</Text>
                                    <RefresherSelect
                                        value={defaults[type]}
                                        onChange={(next) => void setDefault(type, next as DetectMode)}
                                        options={Object.entries(DETECT_MODE_NAMES)}
                                    />
                                </Flex>
                                <Flex gap="2">
                                    <Button variant="soft" color="red" disabled={list.length === 0}
                                            onClick={() => setClearConfirm(type)}>
                                        <Trash2 size={14}/> 전체 삭제
                                    </Button>
                                    <Button onClick={() => setDialog({type, initial: null})}>
                                        <Plus size={14}/> 추가
                                    </Button>
                                </Flex>
                            </Flex>

                            {list.length === 0 ? (
                                <Empty>차단된 {TYPE_NAMES[type]} 없음</Empty>
                            ) : (
                                <Table.Root variant="surface">
                                    <Table.Header>
                                        <Table.Row>
                                            <Table.ColumnHeaderCell>항목</Table.ColumnHeaderCell>
                                            <Table.ColumnHeaderCell>정보</Table.ColumnHeaderCell>
                                            <Table.ColumnHeaderCell width="48px"/>
                                        </Table.Row>
                                    </Table.Header>
                                    <Table.Body>
                                        {list.map((entry) => (
                                            <Table.Row
                                                key={entry.id}
                                                align="center"
                                                style={{cursor: "pointer"}}
                                                onClick={() => setDialog({type, initial: entry})}
                                            >
                                                <Table.RowHeaderCell>
                                                    {type === "DCCON" ? (
                                                        <img src={dcconImage(entry)} alt={entry.extra ?? entry.content}
                                                             style={{display: "block", height: 40}}/>
                                                    ) : (
                                                        <Text weight="medium">{entry.content}</Text>
                                                    )}
                                                </Table.RowHeaderCell>
                                                <Table.Cell>
                                                    <Text size="2" color="gray">
                                                        {entryInfo(entry)}
                                                    </Text>
                                                </Table.Cell>
                                                <Table.Cell>
                                                    <IconButton
                                                        variant="ghost"
                                                        color="gray"
                                                        size="1"
                                                        aria-label="삭제"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            void removeEntry(type, entry.id);
                                                        }}
                                                    >
                                                        <X size={12}/>
                                                    </IconButton>
                                                </Table.Cell>
                                            </Table.Row>
                                        ))}
                                    </Table.Body>
                                </Table.Root>
                            )}
                        </Tabs.Content>
                    );
                })}
            </Tabs.Root>

            {dialog && (
                <BlockDialog
                    type={dialog.type}
                    initial={dialog.initial}
                    onClose={() => setDialog(null)}
                    onSubmit={handleSubmit}
                />
            )}

            {clearConfirm && (
                <ConfirmDialog
                    title={`${TYPE_NAMES[clearConfirm]} 차단 목록을 모두 삭제할까요?`}
                    confirmLabel="삭제"
                    danger
                    onConfirm={() => {
                        void clearType(clearConfirm);
                        setClearConfirm(null);
                    }}
                    onClose={() => setClearConfirm(null)}
                />
            )}

            {notice && (
                <ConfirmDialog title={notice} cancelLabel={null}
                               onClose={() => setNotice(null)} onConfirm={() => setNotice(null)}/>
            )}

            {importOpen && (
                <ImportDialog title="차단 목록 가져오기" onClose={() => setImportOpen(false)} onSubmit={submitImport}/>
            )}
        </Card>
    );
}
