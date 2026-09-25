import {Badge, Box, Button, Dialog, Flex, IconButton, Table, Text, TextArea} from "@radix-ui/themes";
import {Download, Plus, Upload, X} from "lucide-react";
import {useState} from "react";

import {BlockDialog} from "@/components/BlockDialog";
import {ConfirmDialog} from "@/components/ConfirmDialog";
import {RefresherSelect} from "@/components/RefresherSelect";
import {isBlockEntry} from "@/core/block";
import {BLOCK_TYPES, DETECT_MODE_NAMES, TYPE_NAMES} from "@/core/storage/items";
import type {BlockEntry, BlockType, DetectMode} from "@/core/storage/types";
import type {BlockInputFields} from "@/stores/blocks";
import {useBlocksStore} from "@/stores/blocks";

import {Empty, Row, Section} from "./Layout";

/** 디시콘 이미지 (묶음 정규식이면 첫 코드) */
const dcconImage = (entry: BlockEntry): string => {
    const code = entry.isRegex ? (entry.content.match(/^\^\((\w+)\|/)?.[1] ?? entry.content) : entry.content;
    return `https://image.dcinside.com/dccon.php?no=${code}`;
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
    const [importText, setImportText] = useState("");

    const exportBlocks = async (): Promise<void> => {
        try {
            await navigator.clipboard.writeText(JSON.stringify(entries));
            setNotice("차단 목록을 클립보드로 내보냈습니다.");
        } catch {
            setNotice("차단 목록을 내보내는데 실패했습니다.");
        }
    };

    const submitImport = async (): Promise<void> => {
        try {
            const parsed = JSON.parse(importText) as Record<string, unknown>;
            for (const type of BLOCK_TYPES) {
                const list = parsed[type];
                if (!Array.isArray(list)) continue;
                await setEntries(type, list.filter(isBlockEntry));
            }
            setImportOpen(false);
            setImportText("");
            setNotice("차단 목록을 가져왔습니다.");
        } catch {
            setNotice("차단 목록을 가져오는데 실패했습니다.");
        }
    };

    const handleSubmit = async (fields: BlockInputFields): Promise<void> => {
        if (!dialog) return;

        // 디시콘은 생성시 부여된 별명("제목 [패키지번호]")을 유지
        const next = dialog.type === "DCCON" && dialog.initial?.extra ? {
            ...fields,
            extra: dialog.initial.extra
        } : fields;

        if (dialog.initial) await updateEntry(dialog.type, dialog.initial.id, next);
        else await addEntry(dialog.type, next);

        setDialog(null);
    };

    return (
        <Box>
            <Section
                actions={
                    <>
                        <IconButton size="2" variant="ghost" color="gray" title="내보내기"
                                    onClick={() => void exportBlocks()}>
                            <Download size={16}/>
                        </IconButton>
                        <IconButton size="2" variant="ghost" color="gray" title="가져오기"
                                    onClick={() => setImportOpen(true)}>
                            <Upload size={16}/>
                        </IconButton>
                    </>
                }
            >
                <Box mb="4">
                    <Text as="div" size="2" weight="bold" mb="2">
                        차단 모드
                    </Text>
                    {BLOCK_TYPES.map((type) => (
                        <Row
                            key={`mode-${type}`}
                            left={
                                <Text size="2" color="gray">
                                    {TYPE_NAMES[type]}
                                </Text>
                            }
                            right={
                                <RefresherSelect
                                    value={defaults[type]}
                                    onChange={(next) => void setDefault(type, next as DetectMode)}
                                    options={Object.entries(DETECT_MODE_NAMES)}
                                />
                            }
                        />
                    ))}
                </Box>

                {BLOCK_TYPES.map((type) => {
                    const list = entries[type];

                    return (
                        <Box key={type} mb="4">
                            <Flex justify="between" align="center" mb="2">
                                <Text size="2" weight="bold">
                                    {TYPE_NAMES[type]} <Badge color="gray" variant="soft">{list.length}개</Badge>
                                </Text>
                                <Flex gap="2">
                                    <IconButton variant="ghost" color="gray" size="1" title="추가"
                                                onClick={() => setDialog({type, initial: null})}>
                                        <Plus size={14}/>
                                    </IconButton>
                                    <IconButton
                                        variant="ghost"
                                        color="gray"
                                        size="1"
                                        title="전체 삭제"
                                        disabled={list.length === 0}
                                        onClick={() => setClearConfirm(type)}
                                    >
                                        <X size={12}/>
                                    </IconButton>
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
                                            <Table.ColumnHeaderCell/>
                                        </Table.Row>
                                    </Table.Header>
                                    <Table.Body>
                                        {list.map((entry) => (
                                            <Table.Row
                                                key={entry.id}
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
                                                        {[entry.gallery ? `갤러리: ${entry.gallery}` : null, entry.extra].filter(Boolean).join(" · ") || "—"}
                                                    </Text>
                                                </Table.Cell>
                                                <Table.Cell width="48px">
                                                    <IconButton
                                                        variant="ghost"
                                                        color="gray"
                                                        size="1"
                                                        title="삭제"
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
                        </Box>
                    );
                })}
            </Section>

            {dialog && (
                <BlockDialog
                    open
                    type={dialog.type}
                    typeNames={TYPE_NAMES}
                    modeNames={DETECT_MODE_NAMES}
                    initial={dialog.initial}
                    onClose={() => setDialog(null)}
                    onSubmit={handleSubmit}
                />
            )}

            <ConfirmDialog
                open={clearConfirm !== null}
                title={`${clearConfirm ? TYPE_NAMES[clearConfirm] : ""} 차단 목록을 모두 삭제할까요?`}
                confirmLabel="삭제"
                danger
                onConfirm={() => {
                    if (clearConfirm) void clearType(clearConfirm);
                    setClearConfirm(null);
                }}
                onClose={() => setClearConfirm(null)}
            />

            <ConfirmDialog open={notice !== null} title={notice ?? ""} cancelLabel={null}
                           onClose={() => setNotice(null)} onConfirm={() => setNotice(null)}/>

            <Dialog.Root open={importOpen} onOpenChange={(next) => !next && setImportOpen(false)}>
                <Dialog.Content style={{maxWidth: 520}}>
                    <Dialog.Title>차단 목록 가져오기</Dialog.Title>
                    <Dialog.Description size="2" mb="3">
                        내보낸 JSON 데이터를 붙여넣어주세요.
                    </Dialog.Description>

                    <TextArea placeholder="JSON 데이터" value={importText}
                              onChange={(event) => setImportText(event.target.value)} style={{minHeight: 160}}
                              autoFocus/>

                    <Flex gap="3" justify="end" mt="4">
                        <Dialog.Close>
                            <Button variant="soft" color="gray">
                                취소
                            </Button>
                        </Dialog.Close>
                        <Button onClick={() => void submitImport()}>가져오기</Button>
                    </Flex>
                </Dialog.Content>
            </Dialog.Root>
        </Box>
    );
}
