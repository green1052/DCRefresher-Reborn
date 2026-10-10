import {ClipboardCopy, Smartphone} from "lucide-react";
import {useId, useMemo, useRef, useState} from "react";

import {ColorInput} from "@/components/ColorInput";
import {DialogActions, ModalDialog, SubmitForm} from "@/components/dialogs";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Field, FieldError, FieldGroup, FieldLabel} from "@/components/ui/field";
import {Input} from "@/components/ui/input";
import {MEMO_TYPE_NAMES, MEMO_TYPES} from "@/core/storage/items";
import {memoUsageKey} from "@/core/usage";
import type {MemoType} from "@/core/storage/types";
import {normalizeMemoMap, ownMemo, randomColor, useMemosStore} from "@/stores/memos";
import {SAVE_FAILED} from "@/utils/error";
import {isRecord} from "@/utils/record";

import {formatAppMemos, parseAppMemos} from "./appMemo";
import {ImportDialog, useUsage} from "./Layout";
import {ListRow, ListTabs} from "./ListTabs";
import {notify, notifyDone} from "./optionsStore";
import {RefresherSelect} from "./RefresherSelect";

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
    const id = useId();
    const userInput = useRef<HTMLInputElement>(null);
    const textInput = useRef<HTMLInputElement>(null);

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
        // 추가할 때는 비어 있는 대상부터, 고칠 때는(대상이 막혀 있다) 메모부터 입력한다.
        <ModalDialog onClose={onClose} focusOnOpen={editing ? textInput : userInput} className="sm:max-w-[480px]">
            <DialogHeader>
                <DialogTitle>메모 {editing ? "수정" : "추가"}</DialogTitle>
            </DialogHeader>

            <SubmitForm onSubmit={submit} className="flex flex-col gap-4">
                <FieldGroup>
                    <Field orientation="horizontal" className="justify-between">
                        <FieldLabel>종류</FieldLabel>
                        <RefresherSelect
                            value={state.type}
                            disabled={editing}
                            aria-label="종류"
                            onChange={(type) => setState((prev) => ({...prev, type}))}
                            options={MEMO_TYPE_NAMES}
                        />
                    </Field>

                    <Field>
                        <FieldLabel htmlFor={`${id}-user`}>대상</FieldLabel>
                        <Input
                            id={`${id}-user`}
                            placeholder="아이디, 닉네임 또는 IP"
                            value={state.user}
                            ref={userInput}
                            disabled={editing}
                            // 입력 중에 trim하면 닉네임 가운데 공백을 칠 수 없으므로 저장할 때 trim한다.
                            onChange={(ev) => setState((prev) => ({...prev, user: ev.target.value}))}
                        />
                    </Field>

                    <Field>
                        <FieldLabel htmlFor={`${id}-text`}>메모</FieldLabel>
                        <Input
                            id={`${id}-text`}
                            maxLength={160}
                            placeholder="메모를 입력해 주세요 (160자 제한)"
                            value={state.text}
                            ref={textInput}
                            onChange={(ev) => setState((prev) => ({...prev, text: ev.target.value}))}
                        />
                    </Field>

                    <Field>
                        <FieldLabel htmlFor={`${id}-gallery`}>갤러리</FieldLabel>
                        <Input
                            id={`${id}-gallery`}
                            placeholder="갤러리 ID (비우면 모든 갤러리)"
                            value={state.gallery}
                            onChange={(ev) => setState((prev) => ({...prev, gallery: ev.target.value.trim()}))}
                        />
                    </Field>

                    <Field orientation="horizontal" className="justify-between">
                        <FieldLabel>색상</FieldLabel>
                        <div className="flex items-center gap-2">
                            <ColorInput
                                aria-label="메모 색상"
                                value={state.color}
                                onChange={(ev) => setState((prev) => ({...prev, color: ev.target.value}))}
                            />
                            <Button type="button" variant="secondary" onClick={() => setState((prev) => ({...prev, color: randomColor()}))}>
                                랜덤
                            </Button>
                        </div>
                    </Field>

                    {error && <FieldError role="alert">{error}</FieldError>}
                </FieldGroup>

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
    const updateMemos = useMemosStore((state) => state.updateMemos);
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
                await updateMemos(type, (current) => {
                    const merged = {...current};
                    for (const [target, memo] of Object.entries(parsed[type])) merged[target] = {...(ownMemo(merged, target) ?? {color: randomColor()}), text: memo};
                    return merged;
                });
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
            notifyDone(`공앱 형식으로 메모 ${count}개를 복사했습니다.${skipped ? ` 닉네임 메모 ${skipped}개는 공앱에 없는 종류라 뺐습니다.` : ""}`);
        } catch {
            notify("복사하지 못했습니다.");
        }
    };

    const importMemos = async (parsed: Record<string, unknown>): Promise<number> => {
        // 객체만 받는다. 차단 내보내기의 NICK/IP(배열)까지 메모로 세면 다른 데이터인데도 성공으로 알린다.
        const types = MEMO_TYPES.filter((type) => isRecord(parsed[type]));
        // 기존 메모에 합치고, 같은 대상은 가져온 메모로 덮는다.
        for (const type of types) await updateMemos(type, (current) => ({...current, ...normalizeMemoMap(parsed[type])}));
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
                    <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" onClick={() => setAppImport(true)}>
                            <Smartphone data-icon="inline-start"/> 공앱 메모 가져오기
                        </Button>
                        <Button variant="secondary" onClick={() => void copyAppMemos()}>
                            <ClipboardCopy data-icon="inline-start"/> 공앱 형식으로 복사
                        </Button>
                    </div>
                )}
                // 객체 키 순서가 곧 추가 순서다. 숫자로만 된 키는 JS가 앞으로 정렬하는 예외가 있다.
                items={(type) => Object.entries(memos[type])}
                searchText={([user, entry]) => [user, entry.text, entry.gallery]}
                galleryOf={([, entry]) => entry.gallery}
                usedAt={(type, [user]) => used[memoUsageKey(type, user)]}
                onRemoveMany={(type, removed) => {
                    const users = new Set(removed.map(([user]) => user));
                    return updateMemos(type, (current) => Object.fromEntries(Object.entries(current).filter(([user]) => !users.has(user))));
                }}
                row={(type, [user, entry]) => (
                    <ListRow
                        key={user}
                        head={
                            // 편집 버튼 안에 들어가므로 div 대신 span으로 그린다.
                            <span className="flex items-center gap-2">
                                <span className="size-2.5 shrink-0 rounded-full" style={{background: entry.color}}/>
                                <span className="font-medium">{user}</span>
                                {entry.gallery && <Badge variant="secondary">{entry.gallery}</Badge>}
                            </span>
                        }
                        label={user}
                        info={<span className="text-muted-foreground">{entry.text}</span>}
                        used={used[memoUsageKey(type, user)]}
                        onEdit={() => setForm({type, user, text: entry.text, color: entry.color, gallery: entry.gallery ?? ""})}
                        onRemove={() => void removeMemo(type, user).catch(() => notify(SAVE_FAILED))}
                    />
                )}
            />

            {appImport && (
                <ImportDialog
                    title="공앱 메모 가져오기"
                    desc={<>공앱에서 복사한 메모를 붙여 넣어 주세요. 한 줄에 하나씩 <code>아이디-메모</code> 형식이고, 아이디 자리가 IP(예: <code>123.45</code>)면 IP 메모로 넣습니다.</>}
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
