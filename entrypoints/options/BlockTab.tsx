import {Badge, IconButton, Table, Text} from "@radix-ui/themes";
import {Plus, X} from "lucide-react";
import {useState} from "react";

import {BlockDialog} from "@/components/BlockDialog";
import {ConfirmDialog} from "@/components/ConfirmDialog";
import {RefresherSelect} from "@/components/RefresherSelect";
import {BLOCK_TYPES, TYPE_NAMES, DETECT_MODE_NAMES} from "@/core/storage/items";
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

    const [dialog, setDialog] = useState<{type: BlockType; initial: BlockEntry | null} | null>(null);
    const [clearConfirm, setClearConfirm] = useState<BlockType | null>(null);

    const handleSubmit = async (fields: BlockInputFields): Promise<void> => {
        if (!dialog) return;

        // 디시콘은 생성시 부여된 별명("제목 [패키지번호]")을 유지
        const next = dialog.type === "DCCON" && dialog.initial?.extra ? {...fields, extra: dialog.initial.extra} : fields;

        if (dialog.initial) await updateEntry(dialog.type, dialog.initial.id, next);
        else await addEntry(dialog.type, next);

        setDialog(null);
    };

    return (
        <Box>
            <Section title="차단 모드" desc="기본 차단 판별 방식입니다. 개별 항목의 모드가 우선합니다.">
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
            </Section>

            {BLOCK_TYPES.map((type) => {
                const list = entries[type];

                return (
                    <Section
                        key={type}
                        title={
                            <>
                                {TYPE_NAMES[type]} <Badge color="gray" variant="soft">{list.length}개</Badge>
                            </>
                        }
                        actions={
                            <>
                                <IconButton variant="ghost" color="gray" size="2" title="추가" onClick={() => setDialog({type, initial: null})}>
                                    <Plus size={16} />
                                </IconButton>
                                <IconButton
                                    variant="ghost"
                                    color="gray"
                                    size="2"
                                    title="전체 삭제"
                                    disabled={list.length === 0}
                                    onClick={() => setClearConfirm(type)}
                                >
                                    <X size={14} />
                                </IconButton>
                            </>
                        }
                    >
                        {list.length === 0 ? (
                            <Empty>차단된 {TYPE_NAMES[type]} 없음</Empty>
                        ) : (
                            <Table.Root variant="surface">
                                <Table.Header>
                                    <Table.Row>
                                        <Table.ColumnHeaderCell>항목</Table.ColumnHeaderCell>
                                        <Table.ColumnHeaderCell>정보</Table.ColumnHeaderCell>
                                        <Table.ColumnHeaderCell />
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
                                                    <img src={dcconImage(entry)} alt={entry.extra ?? entry.content} style={{display: "block", height: 40}} />
                                                ) : (
                                                    <Text weight="medium">{entry.content}</Text>
                                                )}
                                            </Table.RowHeaderCell>
                                            <Table.Cell>
                                                <Text size="2" color="gray">
                                                    {[entry.gallery ? `갤러리: ${entry.gallery}` : null, entry.extra].filter(Boolean).join(" · ") || "—"}
                                                </Text>
                                            </Table.Cell>
                                            <Table.Cell width={44}>
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
                                                    <X size={12} />
                                                </IconButton>
                                            </Table.Cell>
                                        </Table.Row>
                                    ))}
                                </Table.Body>
                            </Table.Root>
                        )}
                    </Section>
                );
            })}

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
        </Box>
    );
}
