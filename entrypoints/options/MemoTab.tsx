import {Download, Plus, Upload, X} from "lucide-react";
import {Badge, Box, Button, Dialog, Flex, IconButton, Table, Text, TextArea, TextField} from "@radix-ui/themes";
import {useState} from "react";

import {ConfirmDialog} from "@/components/ConfirmDialog";
import {RefresherSelect} from "@/components/RefresherSelect";
import {isMemoEntry} from "@/core/memo";
import {MEMO_TYPE_NAMES, MEMO_TYPES, memoStorage} from "@/core/storage/items";
import type {MemoEntry, MemoType} from "@/core/storage/types";
import {useMemosStore} from "@/stores/memos";

import {Empty, Section} from "./Layout";

const randomColor = (): string => `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0")}`;

interface MemoFormState {
    type: MemoType;
    user: string;
    text: string;
    color: string;
}

const MemoFormDialog = ({
                            initial,
                            onClose,
                            onSubmit
                        }: {
    initial: MemoFormState;
    onClose: () => void;
    onSubmit: (state: MemoFormState) => Promise<void>;
}) => {
    const [state, setState] = useState<MemoFormState>(initial);
    const [error, setError] = useState("");

    const editing = Boolean(initial.user);

    const submit = async (): Promise<void> => {
        if (!state.user.trim()) {
            setError("메모 대상을 입력해주세요.");
            return;
        }

        await onSubmit(state);
        onClose();
    };

    return (
        <Dialog.Root open onOpenChange={(next) => !next && onClose()}>
            <Dialog.Content style={{maxWidth: 480}}>
                <Dialog.Title>메모 {editing ? "수정" : "추가"}</Dialog.Title>

                <Flex direction="column" gap="3" mt="3">
                    <Flex justify="between" align="center">
                        <Text size="2" color="gray">
                            종류
                        </Text>
                        <RefresherSelect
                            value={state.type}
                            disabled={editing}
                            onChange={(next) => setState((prev) => ({...prev, type: next as MemoType}))}
                            options={MEMO_TYPES.map((type) => [type, MEMO_TYPE_NAMES[type]] as [string, string])}
                        />
                    </Flex>

                    <label>
                        <Text as="div" size="2" color="gray" mb="1">
                            대상
                        </Text>
                        <TextField.Root
                            placeholder="유저, 닉네임 또는 IP"
                            value={state.user}
                            disabled={editing}
                            onChange={(event) => setState((prev) => ({...prev, user: event.target.value.trim()}))}
                        />
                    </label>

                    <label>
                        <Text as="div" size="2" color="gray" mb="1">
                            메모
                        </Text>
                        <TextField.Root
                            maxLength={160}
                            placeholder="메모를 입력해주세요 (160자 제한)"
                            value={state.text}
                            onChange={(event) => setState((prev) => ({...prev, text: event.target.value}))}
                            onKeyDown={(event) => event.key === "Enter" && void submit()}
                            autoFocus
                        />
                    </label>

                    <Flex justify="between" align="center">
                        <Text size="2" color="gray">
                            색상
                        </Text>
                        <Flex gap="2" align="center">
                            <input
                                type="color"
                                value={state.color}
                                onChange={(event) => setState((prev) => ({...prev, color: event.target.value}))}
                                style={{
                                    width: 36,
                                    height: 28,
                                    padding: 0,
                                    border: 0,
                                    background: "none",
                                    cursor: "pointer"
                                }}
                            />
                            <Button size="2" variant="soft"
                                    onClick={() => setState((prev) => ({...prev, color: randomColor()}))}>
                                랜덤
                            </Button>
                        </Flex>
                    </Flex>

                    {error && (
                        <Text size="2" color="red">
                            {error}
                        </Text>
                    )}
                </Flex>

                <Flex gap="3" justify="end" mt="4">
                    <Dialog.Close>
                        <Button variant="soft" color="gray">
                            취소
                        </Button>
                    </Dialog.Close>
                    <Button onClick={() => void submit()}>{editing ? "수정" : "추가"}</Button>
                </Flex>
            </Dialog.Content>
        </Dialog.Root>
    );
};

export function MemoTab() {
    const memos = useMemosStore((state) => state.memos);
    const setMemo = useMemosStore((state) => state.setMemo);
    const removeMemo = useMemosStore((state) => state.removeMemo);
    const clearType = useMemosStore((state) => state.clearType);
    const setMemosRaw = useMemosStore((state) => state.setMemosRaw);

    const [form, setForm] = useState<MemoFormState | null>(null);
    const [clearConfirm, setClearConfirm] = useState<MemoType | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [importOpen, setImportOpen] = useState(false);
    const [importText, setImportText] = useState("");

    const exportMemos = async (): Promise<void> => {
        try {
            await navigator.clipboard.writeText(JSON.stringify(memos));
            setNotice("메모를 클립보드로 내보냈습니다.");
        } catch {
            setNotice("메모를 내보내는데 실패했습니다.");
        }
    };

    const submitImport = async (): Promise<void> => {
        try {
            const parsed = JSON.parse(importText) as Record<string, unknown>;
            for (const type of MEMO_TYPES) {
                const map = parsed[type];
                if (!map || typeof map !== "object") continue;

                const next: Record<string, MemoEntry> = {};
                for (const [user, entry] of Object.entries(map as Record<string, unknown>)) {
                    if (isMemoEntry(entry)) next[user] = entry;
                }

                setMemosRaw(type, next);
                await memoStorage[type].setValue(next);
            }
            setImportOpen(false);
            setImportText("");
            setNotice("메모를 가져왔습니다.");
        } catch {
            setNotice("메모를 가져오는데 실패했습니다.");
        }
    };

    return (
        <Box>
            <Section
                actions={
                    <>
                        <IconButton size="2" variant="ghost" color="gray" title="내보내기"
                                    onClick={() => void exportMemos()}>
                            <Download size={16}/>
                        </IconButton>
                        <IconButton size="2" variant="ghost" color="gray" title="가져오기"
                                    onClick={() => setImportOpen(true)}>
                            <Upload size={16}/>
                        </IconButton>
                    </>
                }
            >
                {MEMO_TYPES.map((type, index) => {
                    const map = memos[type];

                    return (
                        <Box key={type} mb="4" mt={index > 0 ? "4" : undefined}>
                            <Flex justify="between" align="center" mb="2">
                                <Text size="2" weight="bold">
                                    {MEMO_TYPE_NAMES[type]} <Badge color="gray"
                                                                   variant="soft">{Object.keys(map).length}개</Badge>
                                </Text>
                                <Flex gap="2">
                                    <IconButton
                                        variant="ghost"
                                        color="gray"
                                        size="1"
                                        title="추가"
                                        onClick={() => setForm({type, user: "", text: "", color: randomColor()})}
                                    >
                                        <Plus size={14}/>
                                    </IconButton>
                                    <IconButton
                                        variant="ghost"
                                        color="gray"
                                        size="1"
                                        title="전체 삭제"
                                        disabled={Object.keys(map).length === 0}
                                        onClick={() => setClearConfirm(type)}
                                    >
                                        <X size={12}/>
                                    </IconButton>
                                </Flex>
                            </Flex>

                            {Object.keys(map).length === 0 ? (
                                <Empty>{MEMO_TYPE_NAMES[type]} 메모 없음</Empty>
                            ) : (
                                <Table.Root variant="surface">
                                    <Table.Header>
                                        <Table.Row>
                                            <Table.ColumnHeaderCell>대상</Table.ColumnHeaderCell>
                                            <Table.ColumnHeaderCell>메모</Table.ColumnHeaderCell>
                                            <Table.ColumnHeaderCell/>
                                        </Table.Row>
                                    </Table.Header>
                                    <Table.Body>
                                        {Object.entries(map).map(([user, entry]) => (
                                            <Table.Row
                                                key={user}
                                                style={{cursor: "pointer"}}
                                                onClick={() => setForm({
                                                    type,
                                                    user,
                                                    text: entry.text,
                                                    color: entry.color
                                                })}
                                            >
                                                <Table.RowHeaderCell>
                                                    <Flex align="center" gap="2">
                                                        <span style={{
                                                            width: 10,
                                                            height: 10,
                                                            borderRadius: "50%",
                                                            background: entry.color,
                                                            flex: "none"
                                                        }}/>
                                                        <Text weight="medium">{user}</Text>
                                                    </Flex>
                                                </Table.RowHeaderCell>
                                                <Table.Cell>
                                                    <Text color="gray">{entry.text}</Text>
                                                </Table.Cell>
                                                <Table.Cell width="48px">
                                                    <IconButton
                                                        variant="ghost"
                                                        color="gray"
                                                        size="1"
                                                        title="삭제"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            void removeMemo(type, user);
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

            {form && (
                <MemoFormDialog
                    initial={form}
                    onClose={() => setForm(null)}
                    onSubmit={(next) => setMemo(next.type, next.user, {text: next.text, color: next.color})}
                />
            )}

            <ConfirmDialog
                open={clearConfirm !== null}
                title={`${clearConfirm ? MEMO_TYPE_NAMES[clearConfirm] : ""} 메모를 모두 삭제할까요?`}
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
                    <Dialog.Title>메모 가져오기</Dialog.Title>
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

export type {MemoEntry};
