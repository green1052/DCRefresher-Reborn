import {Plus, X} from "lucide-react";
import {Badge, Box, Button, Dialog, Flex, IconButton, Link, Text, TextField} from "@radix-ui/themes";
import {useState} from "react";

import {ConfirmDialog} from "@/components/ConfirmDialog";
import {RefresherSelect} from "@/components/RefresherSelect";
import {MEMO_TYPES, MEMO_TYPE_NAMES} from "@/core/storage/items";
import type {MemoEntry, MemoType} from "@/core/storage/types";
import {useMemosStore} from "@/stores/memos";

import {Empty, Section} from "./Layout";

const MEMO_TARGET = "https://dcrefresher.green1052.com/utils/convert-memo";

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
                                style={{width: 36, height: 28, padding: 0, border: 0, background: "none", cursor: "pointer"}}
                            />
                            <Button size="2" variant="soft" onClick={() => setState((prev) => ({...prev, color: randomColor()}))}>
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

    const [form, setForm] = useState<MemoFormState | null>(null);
    const [clearConfirm, setClearConfirm] = useState<MemoType | null>(null);

    return (
        <Box>
            <Section
                title="데이터 관리"
                desc={
                    <Link href={MEMO_TARGET} target="_blank" rel="noreferrer">
                        메모 변환
                    </Link>
                }
            >
                <Text size="2" color="gray">
                    갤로그/미리보기 등에서 유저 메모를 표시합니다.
                </Text>
            </Section>

            {MEMO_TYPES.map((type) => {
                const map = memos[type];

                return (
                    <Section
                        key={type}
                        title={
                            <>
                                {MEMO_TYPE_NAMES[type]} <Badge color="gray" variant="soft">{Object.keys(map).length}개</Badge>
                            </>
                        }
                        actions={
                            <>
                                <IconButton
                                    variant="ghost"
                                    color="gray"
                                    size="2"
                                    title="추가"
                                    onClick={() => setForm({type, user: "", text: "", color: randomColor()})}
                                >
                                    <Plus size={16} />
                                </IconButton>
                                <IconButton
                                    variant="ghost"
                                    color="gray"
                                    size="2"
                                    title="전체 삭제"
                                    disabled={Object.keys(map).length === 0}
                                    onClick={() => setClearConfirm(type)}
                                >
                                    <X size={14} />
                                </IconButton>
                            </>
                        }
                    >
                        {Object.keys(map).length === 0 ? (
                            <Empty>{MEMO_TYPE_NAMES[type]} 메모 없음</Empty>
                        ) : (
                            <Flex wrap="wrap" gap="2">
                                {Object.entries(map).map(([user, entry]) => (
                                    <Flex key={user} align="center" gap="1" style={{border: "1px solid var(--gray-a5)", borderRadius: 999, padding: "2px 6px"}}>
                                        <Box
                                            asChild
                                            style={{
                                                background: "none",
                                                border: "none",
                                                padding: 0,
                                                cursor: "pointer",
                                                color: "var(--gray-12)",
                                                font: "inherit",
                                                maxWidth: 240,
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap"
                                            }}
                                        >
                                            <button type="button" title={entry.text} onClick={() => setForm({type, user, text: entry.text, color: entry.color})}>
                                                {user} ({entry.text.slice(0, 10)})
                                            </button>
                                        </Box>
                                        <IconButton variant="ghost" color="gray" size="2" title="삭제" onClick={() => void removeMemo(type, user)}>
                                            <X size={12} />
                                        </IconButton>
                                    </Flex>
                                ))}
                            </Flex>
                        )}
                    </Section>
                );
            })}

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
        </Box>
    );
}

export type {MemoEntry};
