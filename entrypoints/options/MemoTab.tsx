import {Badge, Box, Button, Code, Dialog, Flex, Text, TextField} from "@radix-ui/themes";
import {ClipboardCopy, Smartphone} from "lucide-react";
import {useMemo, useState} from "react";

import {DialogActions, SubmitForm} from "@/components/ConfirmDialog";
import {RefresherSelect} from "@/components/RefresherSelect";
import {ModalDialog} from "@/components/ModalDialog";
import {MEMO_TYPE_NAMES, MEMO_TYPES} from "@/core/storage/items";
import {memoUsageKey} from "@/core/usage";
import type {MemoType} from "@/core/storage/types";
import {normalizeMemoMap, randomColor, useMemosStore} from "@/stores/memos";
import {SAVE_FAILED} from "@/utils/error";
import {isRecord} from "@/utils/record";

import {formatAppMemos, parseAppMemos} from "./appMemo";
import {ImportDialog, ListRow, ListTabs, useUsage} from "./Layout";
import {notify} from "./optionsStore";

interface MemoFormState {
    type: MemoType;
    user: string;
    text: string;
    color: string;
    /** 비우면 모든 갤러리. */
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
            setError("메모 대상을 입력해 주세요.");
            return;
        }
        // 빈 메모를 저장하면 빈 "[]" 배지만 붙는다.
        if (!state.text.trim()) {
            setError("메모를 입력해 주세요.");
            return;
        }
        // 추가로 기존 메모를 덮어쓰지 않게 한다. 고치려면 목록에서 수정한다.
        if (!editing && Object.hasOwn(useMemosStore.getState().memos[state.type], state.user.trim())) {
            setError("이미 메모가 있습니다.");
            return;
        }

        // 수정할 때는 기존 키를 그대로 쓴다. 앞뒤 공백이 있는 기존 키를 trim하면 새 항목으로 갈라진다.
        try {
            await onSubmit(editing ? state : {...state, user: state.user.trim()});
        } catch {
            setError(SAVE_FAILED);
            return;
        }
        onClose();
    };

    return (
        <ModalDialog onClose={onClose} maxWidth="480px" aria-describedby={undefined}>
            <Dialog.Title>메모 {editing ? "수정" : "추가"}</Dialog.Title>

            <SubmitForm onSubmit={submit}>
                <Flex direction="column" gap="3" mt="3">
                    <Flex justify="between" align="center">
                        <Text size="2" color="gray">
                            종류
                        </Text>
                        <RefresherSelect
                            value={state.type}
                            disabled={editing}
                            aria-label="종류"
                            onChange={(type) => setState((prev) => ({...prev, type}))}
                            options={MEMO_TYPE_NAMES}
                        />
                    </Flex>

                    <label>
                        <Text as="div" size="2" color="gray" mb="1">
                            대상
                        </Text>
                        <TextField.Root
                            placeholder="아이디, 닉네임 또는 IP"
                            value={state.user}
                            disabled={editing}
                            // 추가할 때는 비어 있는 대상부터, 고칠 때는(대상이 막혀 있다) 메모부터 입력한다.
                            autoFocus={!editing}
                            // 입력 중에 trim하면 닉네임 가운데 공백을 칠 수 없으므로 저장할 때 trim한다.
                            onChange={(ev) => setState((prev) => ({...prev, user: ev.target.value}))}
                        />
                    </label>

                    <label>
                        <Text as="div" size="2" color="gray" mb="1">
                            메모
                        </Text>
                        <TextField.Root
                            maxLength={160}
                            placeholder="메모를 입력해 주세요 (160자 제한)"
                            value={state.text}
                            onChange={(ev) => setState((prev) => ({...prev, text: ev.target.value}))}
                            autoFocus={editing}
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
                            <Button type="button" size="2" variant="soft"
                                    onClick={() => setState((prev) => ({...prev, color: randomColor()}))}>
                                랜덤
                            </Button>
                        </Flex>
                    </Flex>

                    {error && (
                        <Text size="2" color="red" role="alert">
                            {error}
                        </Text>
                    )}
                </Flex>

                <DialogActions>
                    <Button type="submit">{editing ? "수정" : "추가"}</Button>
                </DialogActions>
            </SubmitForm>
        </ModalDialog>
    );
};

export function MemoTab() {
    const memos = useMemosStore((state) => state.memos);
    const setMemo = useMemosStore((state) => state.setMemo);
    const removeMemo = useMemosStore((state) => state.removeMemo);
    const setMemos = useMemosStore((state) => state.setMemos);
    const ids = useMemo(() => MEMO_TYPES.flatMap((type) => Object.keys(memos[type]).map((user) => memoUsageKey(type, user))), [memos]);
    const used = useUsage("memo", ids);

    const [form, setForm] = useState<MemoFormState | null>(null);
    const [appImport, setAppImport] = useState(false);

    /** 공앱 메모를 합친다. 이미 있는 대상은 글만 바꾸고 색·갤러리는 그대로 둔다. */
    const importAppMemos = async (text: string): Promise<string | undefined> => {
        const {memos: parsed, skipped} = parseAppMemos(text);
        const count = Object.keys(parsed.UID).length + Object.keys(parsed.IP).length;
        if (count === 0) {
            notify("공앱 메모가 없습니다. 한 줄에 하나씩 아이디-메모 형식으로 붙여 넣어 주세요.");
            return;
        }
        try {
            for (const type of ["UID", "IP"] as const) {
                const merged = {...memos[type]};
                for (const [target, memo] of Object.entries(parsed[type])) merged[target] = {...((Object.hasOwn(merged, target) ? merged[target] : undefined) ?? {color: randomColor()}), text: memo};
                await setMemos(type, merged);
            }
        } catch {
            notify(SAVE_FAILED);
            return;
        }
        return `공앱 메모 ${count}개를 가져왔습니다.${skipped ? ` (형식이 맞지 않는 ${skipped}줄은 건너뛰었습니다.)` : ""}`;
    };

    const copyAppMemos = async (): Promise<void> => {
        const {text, count, skipped} = formatAppMemos(memos);
        if (count === 0) {
            notify("공앱으로 옮길 아이디·IP 메모가 없습니다.");
            return;
        }
        try {
            await navigator.clipboard.writeText(text);
            notify(`공앱 형식으로 메모 ${count}개를 복사했습니다.${skipped ? ` 닉네임 메모 ${skipped}개는 공앱에 없는 종류라 뺐습니다.` : ""}`);
        } catch {
            notify("복사하지 못했습니다.");
        }
    };

    const importMemos = async (parsed: Record<string, unknown>): Promise<number> => {
        // 객체만 받는다. 차단 내보내기의 NICK/IP(배열)까지 메모로 세면 다른 데이터인데도 성공으로 알린다.
        const types = MEMO_TYPES.filter((type) => isRecord(parsed[type]));
        // 기존 메모에 합치고, 같은 대상은 가져온 메모로 덮는다.
        for (const type of types) await setMemos(type, {...memos[type], ...normalizeMemoMap(parsed[type])});
        return types.length;
    };

    return (
        <>
            <ListTabs
                types={MEMO_TYPES}
                names={MEMO_TYPE_NAMES}
                label="메모"
                columns={["대상", "메모"]}
                emptyText={(type) => `${MEMO_TYPE_NAMES[type]} 메모 없음`}
                exportData={() => memos}
                importData={importMemos}
                onClear={(type) => setMemos(type, {})}
                onAdd={(type) => setForm({type, user: "", text: "", color: randomColor(), gallery: ""})}
                // 공앱(디시인사이드 모바일 앱) 메모는 한 줄에 하나씩 "아이디-메모" 글이다.
                toolbar={() => (
                    <Flex gap="2" wrap="wrap">
                        <Button size="2" variant="soft" color="gray" onClick={() => setAppImport(true)}>
                            <Smartphone size={14}/> 공앱 메모 가져오기
                        </Button>
                        <Button size="2" variant="soft" color="gray" onClick={() => void copyAppMemos()}>
                            <ClipboardCopy size={14}/> 공앱 형식으로 복사
                        </Button>
                    </Flex>
                )}
                // 객체 키 순서가 곧 추가 순서다. 숫자로만 된 키는 JS가 앞으로 정렬하는 예외가 있다.
                items={(type) => Object.entries(memos[type])}
                searchText={([user, entry]) => [user, entry.text, entry.gallery]}
                galleryOf={([, entry]) => entry.gallery}
                usedAt={(type, [user]) => used[memoUsageKey(type, user)]}
                onRemoveMany={(type, removed) => {
                    const users = new Set(removed.map(([user]) => user));
                    return setMemos(type, Object.fromEntries(Object.entries(memos[type]).filter(([user]) => !users.has(user))));
                }}
                row={(type, [user, entry]) => (
                    <ListRow
                        key={user}
                        head={
                            // 편집 버튼 안에 들어가므로 div 대신 span으로 그린다.
                            <Flex as="span" align="center" gap="2">
                                <Box as="span" width="10px" height="10px" flexShrink="0" style={{borderRadius: "50%", background: entry.color}}/>
                                <Text weight="medium">{user}</Text>
                                {entry.gallery && <Badge size="1" variant="soft" color="gray">{entry.gallery}</Badge>}
                            </Flex>
                        }
                        info={<Text color="gray">{entry.text}</Text>}
                        used={used[memoUsageKey(type, user)]}
                        onEdit={() => setForm({type, user, text: entry.text, color: entry.color, gallery: entry.gallery ?? ""})}
                        onRemove={() => void removeMemo(type, user).catch(() => notify(SAVE_FAILED))}
                    />
                )}
            />

            {appImport && (
                <ImportDialog
                    title="공앱 메모 가져오기"
                    desc={<>공앱에서 복사한 메모를 붙여 넣어 주세요. 한 줄에 하나씩 <Code>아이디-메모</Code> 형식이고, 아이디 자리가 IP(예: <Code>123.45</Code>)면 IP 메모로 넣습니다.</>}
                    placeholder="아이디-메모"
                    onClose={() => setAppImport(false)}
                    onSubmit={importAppMemos}
                />
            )}

            {form && (
                <MemoFormDialog
                    initial={form}
                    onClose={() => setForm(null)}
                    onSubmit={(next) => setMemo(next.type, next.user, {text: next.text.trim(), color: next.color, gallery: next.gallery || undefined})}
                />
            )}
        </>
    );
}
