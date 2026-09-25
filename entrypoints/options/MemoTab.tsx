import {Badge, Box, Button, Dialog, Flex, Text, TextField} from "@radix-ui/themes";
import {useState} from "react";

import {DialogActions} from "@/components/ConfirmDialog";
import {RefresherSelect} from "@/components/RefresherSelect";
import {MEMO_TYPE_NAMES, MEMO_TYPES} from "@/core/storage/items";
import type {MemoType} from "@/core/storage/types";
import {normalizeMemoMap, randomColor, useMemosStore} from "@/stores/memos";

import {ListRow, ListTabs} from "./Layout";

interface MemoFormState {
    type: MemoType;
    user: string;
    text: string;
    color: string;
    /** 비우면 모든 갤러리 */
    gallery: string;
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
        // 추가로 기존 메모를 덮어쓰지 않게 — 고치려면 목록에서 눌러 수정
        if (!editing && Object.hasOwn(useMemosStore.getState().memos[state.type], state.user.trim())) {
            setError("이미 메모가 있습니다.");
            return;
        }

        // 수정 때는 기존 키 그대로 — 다듬으면 공백 있는 키가 새 항목으로 갈라진다
        await onSubmit(editing ? state : {...state, user: state.user.trim()});
        onClose();
    };

    return (
        <Dialog.Root open onOpenChange={(next) => !next && onClose()}>
            <Dialog.Content maxWidth="480px" aria-describedby={undefined}>
                <Dialog.Title>메모 {editing ? "수정" : "추가"}</Dialog.Title>

                <Flex direction="column" gap="3" mt="3">
                    <Flex justify="between" align="center">
                        <Text size="2" color="gray">
                            종류
                        </Text>
                        <RefresherSelect
                            value={state.type}
                            disabled={editing}
                            aria-label="종류"
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
                            // 입력 중엔 다듬지 않는다 — 닉네임 가운데 공백을 칠 수 있게 (저장할 때 trim)
                            onChange={(ev) => setState((prev) => ({...prev, user: ev.target.value}))}
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
                            onChange={(ev) => setState((prev) => ({...prev, text: ev.target.value}))}
                            onKeyDown={(ev) => ev.key === "Enter" && !ev.nativeEvent.isComposing && void submit()}
                            autoFocus
                        />
                    </label>

                    <label>
                        <Text as="div" size="2" color="gray" mb="1">
                            갤러리
                        </Text>
                        <TextField.Root
                            placeholder="갤러리 ID (비우면 모든 갤러리)"
                            value={state.gallery}
                            onChange={(ev) => setState((prev) => ({...prev, gallery: ev.target.value.trim()}))}
                        />
                    </label>

                    <Flex justify="between" align="center">
                        <Text size="2" color="gray">
                            색상
                        </Text>
                        <Flex gap="2" align="center">
                            <input
                                type="color"
                                aria-label="메모 색상"
                                value={state.color}
                                onChange={(ev) => setState((prev) => ({...prev, color: ev.target.value}))}
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

                <DialogActions>
                    <Button onClick={() => void submit()}>{editing ? "수정" : "추가"}</Button>
                </DialogActions>
            </Dialog.Content>
        </Dialog.Root>
    );
};

export function MemoTab() {
    const memos = useMemosStore((state) => state.memos);
    const setMemo = useMemosStore((state) => state.setMemo);
    const removeMemo = useMemosStore((state) => state.removeMemo);
    const clearType = useMemosStore((state) => state.clearType);
    const setMemos = useMemosStore((state) => state.setMemos);

    const [form, setForm] = useState<MemoFormState | null>(null);

    const importMemos = async (parsed: Record<string, unknown>): Promise<number> => {
        // 객체만 받는다 — 차단 내보내기의 NICK/IP(배열)를 메모로 세면 다른 데이터인데도 성공으로 알린다
        const types = MEMO_TYPES.filter((type) => {
            const map = parsed[type];
            return typeof map === "object" && map !== null && !Array.isArray(map);
        });
        // 기존 메모에 합친다 — 같은 대상은 가져온 쪽으로
        for (const type of types) await setMemos(type, {...memos[type], ...normalizeMemoMap(parsed[type])});
        return types.length;
    };

    return (
        <>
            <ListTabs
                types={MEMO_TYPES}
                names={MEMO_TYPE_NAMES}
                counts={Object.fromEntries(MEMO_TYPES.map((type) => [type, Object.keys(memos[type]).length])) as Record<MemoType, number>}
                label="메모"
                columns={["대상", "메모"]}
                emptyText={(type) => `${MEMO_TYPE_NAMES[type]} 메모 없음`}
                exportData={() => memos}
                importData={importMemos}
                onClear={clearType}
                onAdd={(type) => setForm({type, user: "", text: "", color: randomColor(), gallery: ""})}
                rows={(type) =>
                    Object.entries(memos[type]).map(([user, entry]) => (
                        <ListRow
                            key={user}
                            head={
                                <Flex align="center" gap="2">
                                    <Box width="10px" height="10px" flexShrink="0" style={{borderRadius: "50%", background: entry.color}}/>
                                    <Text weight="medium">{user}</Text>
                                    {entry.gallery && <Badge size="1" variant="soft" color="gray">{entry.gallery}</Badge>}
                                </Flex>
                            }
                            info={<Text color="gray">{entry.text}</Text>}
                            onEdit={() => setForm({type, user, text: entry.text, color: entry.color, gallery: entry.gallery ?? ""})}
                            onRemove={() => void removeMemo(type, user)}
                        />
                    ))
                }
            />

            {form && (
                <MemoFormDialog
                    initial={form}
                    onClose={() => setForm(null)}
                    onSubmit={(next) => setMemo(next.type, next.user, {text: next.text, color: next.color, gallery: next.gallery || undefined})}
                />
            )}
        </>
    );
}
