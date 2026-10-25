import {ClipboardCopy, Smartphone} from "lucide-react";
import {useCallback, useId, useMemo, useRef, useState} from "react";

import {ColorInput} from "@/components/ColorInput";
import {DialogActions, ModalDialog, SubmitForm} from "@/components/dialogs";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Field, FieldError, FieldGroup, FieldLabel} from "@/components/ui/field";
import {Input} from "@/components/ui/input";
import {MEMO_TYPE_NAMES, MEMO_TYPES} from "@/core/storage/items";
import {memoUsageKey} from "@/core/usage";
import type {MemoEntry, MemoType} from "@/core/storage/types";
import {normalizeMemoMap, ownMemo, randomColor, useMemosStore} from "@/stores/memos";
import {SAVE_FAILED} from "@/utils/error";

import {formatAppMemos, parseAppMemos} from "./appMemo";
import {useUsage} from "../shared/hooks";
import {ImportDialog} from "../shared/ImportDialog";
import {ListRow, ListTabs} from "../lists/ListTabs";
import {copyText, notify} from "../optionsStore";
import {RefresherSelect} from "../shared/RefresherSelect";

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
    const set = (patch: Partial<MemoFormState>): void => setState((prev) => ({...prev, ...patch}));
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

            <SubmitForm onSubmit={submit}>
                <FieldGroup>
                    <Field orientation="horizontal" className="justify-between">
                        <FieldLabel>종류</FieldLabel>
                        <RefresherSelect
                            value={state.type}
                            disabled={editing}
                            aria-label="종류"
                            onChange={(type) => set({type})}
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
                            onChange={(ev) => set({user: ev.target.value})}
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
                            onChange={(ev) => set({text: ev.target.value})}
                        />
                    </Field>

                    <Field>
                        <FieldLabel htmlFor={`${id}-gallery`}>갤러리</FieldLabel>
                        <Input
                            id={`${id}-gallery`}
                            placeholder="갤러리 ID (비우면 모든 갤러리)"
                            value={state.gallery}
                            onChange={(ev) => set({gallery: ev.target.value.trim()})}
                        />
                    </Field>

                    <Field orientation="horizontal" className="justify-between">
                        <FieldLabel>색상</FieldLabel>
                        <div className="flex items-center gap-2">
                            <ColorInput
                                aria-label="메모 색상"
                                value={state.color}
                                onChange={(ev) => set({color: ev.target.value})}
                            />
                            <Button type="button" variant="secondary" onClick={() => set({color: randomColor()})}>
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

// 크롬 저장소는 객체 키를 정렬해 돌려주므로 키 순서는 추가 순서가 아니다. 추가 시각으로 세운다.
// 정렬은 안정적이라 시각이 없는 옛 메모는 오래된 쪽에 저장소 순서대로 남는다.
const byAdded = (map: Record<string, MemoEntry>): [string, MemoEntry][] => Object.entries(map).sort(([, a], [, b]) => (a.added ?? 0) - (b.added ?? 0));

export function MemoTab() {
    const memos = useMemosStore((state) => state.memos);
    const setMemo = useMemosStore((state) => state.setMemo);
    const updateMemos = useMemosStore((state) => state.updateMemos);
    const ids = useMemo(() => MEMO_TYPES.flatMap((type) => Object.keys(memos[type]).map((user) => memoUsageKey(type, user))), [memos]);
    const used = useUsage("memo", ids);
    const sorted = useMemo(() => ({UID: byAdded(memos.UID), NICK: byAdded(memos.NICK), IP: byAdded(memos.IP)}), [memos]);

    // ListTabs의 걸르기 메모는 이 넷의 참조가 바뀔 때만 다시 한다 (BlockTab의 같은 자리 참고).
    const items = useCallback((type: MemoType): readonly [string, MemoEntry][] => sorted[type], [sorted]);
    const searchText = useCallback((item: [string, MemoEntry]): (string | undefined)[] => [item[0], item[1].text, item[1].gallery], []);
    const galleryOf = useCallback((item: [string, MemoEntry]): string | undefined => item[1].gallery, []);
    const usedAt = useCallback((type: MemoType, item: [string, MemoEntry]): number | undefined => used[memoUsageKey(type, item[0])], [used]);

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
                // 새 메모의 색은 밖에서 정한다. updateMemos의 change는 두 번(스토어·저장소 값) 불려, 안에서 고르면 저장 뒤 색이 한 번 바뀐다.
                const incoming = Object.entries(parsed[type]).map(([target, text]) => [target, text, randomColor()] as const);
                const added = Date.now();
                await updateMemos(type, (current) => {
                    // 보통 객체면 대상이 __proto__인 메모가 대입에서 조용히 사라진다 (parseAppMemos가 살려 온 값).
                    const merged = Object.assign(Object.create(null) as typeof current, current);
                    for (const [target, text, color] of incoming) {
                        merged[target] = {...(ownMemo(merged, target) ?? {color, added}), text};
                    }
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
        await copyText(text, `공앱 형식으로 메모 ${count}개를 복사했습니다.${skipped ? ` 닉네임 메모 ${skipped}개는 공앱에 없는 종류라 뺐습니다.` : ""}`, "복사하지 못했습니다.");
    };

    const importMemos = async (parsed: Record<string, unknown>): Promise<number> => {
        // 유효한 메모 수를 센다. 차단 내보내기의 NICK/IP(배열)나 틀린 메모까지 세면 다른 데이터인데도 성공으로 알린다.
        let count = 0;
        for (const type of MEMO_TYPES) {
            const imported = normalizeMemoMap(parsed[type]);
            const size = Object.keys(imported).length;
            if (size === 0) continue;
            await updateMemos(type, (current) => ({...current, ...imported}));
            count += size;
        }
        return count;
    };

    return (
        <>
            <ListTabs
                types={MEMO_TYPES}
                names={MEMO_TYPE_NAMES}
                label="메모"
                fileName="dcrefresher-memo"
                columns={["대상", "메모"]}
                emptyText={(type) => `${MEMO_TYPE_NAMES[type]} 메모 없음`}
                exportData={() => memos}
                importData={importMemos}
                onClear={(type) => updateMemos(type, () => ({}))}
                onAdd={(type) => setForm({type, user: "", text: "", color: randomColor(), gallery: ""})}
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
                items={items}
                searchText={searchText}
                galleryOf={galleryOf}
                usedAt={usedAt}
                onRemoveMany={(type, removed) => {
                    const users = new Set(removed.map(([user]) => user));
                    return updateMemos(type, (current) => Object.fromEntries(Object.entries(current).filter(([user]) => !users.has(user))));
                }}
                itemKey={([user]) => user}
                onRestore={(type, restore) => updateMemos(type, (current) => Object.fromEntries(restore(Object.entries(current))))}
                row={(type, [user, entry], remove) => (
                    <ListRow
                        key={user}
                        head={
                            // 편집 버튼 안에 들어가므로 div 대신 span으로 그린다.
                            <span className="flex items-center gap-2">
                                {/* background 축약은 가져온 메모의 url(…)을 배경 이미지로 불러온다. 색 속성만 쓴다. */}
                                <span className="size-2.5 shrink-0 rounded-full" style={{backgroundColor: entry.color}}/>
                                <span className="font-medium">{user}</span>
                                {entry.gallery && <Badge variant="secondary">{entry.gallery}</Badge>}
                            </span>
                        }
                        label={user}
                        info={<span className="text-muted-foreground">{entry.text}</span>}
                        used={used[memoUsageKey(type, user)]}
                        onEdit={() => setForm({type, user, text: entry.text, color: entry.color, gallery: entry.gallery ?? ""})}
                        onRemove={remove}
                    />
                )}
            />

            {appImport && (
                <ImportDialog
                    title="공앱 메모 가져오기"
                    desc={<>공앱에서 복사한 메모를 붙여 넣어 주세요. 한 줄에 하나씩 <code>아이디-메모</code> 형식이고, 아이디 자리가 IP(예: <code>123.45</code>)면 IP 메모로 넣습니다.</>}
                    placeholder="아이디-메모"
                    fromFile={false}
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
