import {Shuffle} from "lucide-react";
import {useId, useRef, useState} from "react";

import {ColorInput} from "@/components/ColorInput";
import {ModalDialog, SubmitForm} from "@/components/dialogs";
import {Button} from "@/components/ui/button";
import {Checkbox} from "@/components/ui/checkbox";
import {DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Field, FieldLabel} from "@/components/ui/field";
import {InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput} from "@/components/ui/input-group";
import {ToggleGroup, ToggleGroupItem} from "@/components/ui/toggle-group";
import {queryString} from "@/core/http/urls";
import {MEMO_TYPE_NAMES, MEMO_TYPES} from "@/core/storage/items";
import type {MemoType} from "@/core/storage/types";
import {ownMemo, randomColor, useMemosStore} from "@/stores/memos";
import {type MemoTargetState, useUiStore} from "@/stores/ui";
import {SAVE_FAILED} from "@/utils/error";
import {arrayIncludes} from "@/utils/typed";

const MemoDialogInner = ({state}: { state: MemoTargetState }) => {
    const closeMemo = useUiStore((s) => s.closeMemo);
    const showToast = useUiStore((s) => s.showToast);
    const memos = useMemosStore((s) => s.memos);
    const setMemo = useMemosStore((s) => s.setMemo);
    const removeMemo = useMemosStore((s) => s.removeMemo);
    const id = useId();
    const input = useRef<HTMLInputElement>(null);

    // 지금 보고 있는 갤러리. 이 갤러리에서만 보이는 메모로 저장할 때 쓴다.
    const gallery = queryString("id");

    const memoOf = (memoType: MemoType, user: string) => ownMemo(memos[memoType], user);

    // 열릴 때와 종류를 바꿀 때 기존 메모로 채운다.
    // 범위(scope)는 저장된 갤러리를 그대로 가져와, 다른 갤러리 전용 메모를 여기서 저장해도 범위가 바뀌지 않게 한다.
    const prefill = (memoType: MemoType): { text: string; color: string; scope?: string } => {
        const memo = memoOf(memoType, state.targets[memoType] ?? "");
        return {text: memo?.text ?? "", color: memo?.color ?? randomColor(), scope: memo?.gallery};
    };

    const [type, setType] = useState<MemoType>(state.initialType);
    const [form, setForm] = useState(() => prefill(state.initialType));
    // 입력을 바꿨는지. 종류를 넘겼을 때 저장된 메모로 다시 채울지 정한다.
    const [touched, setTouched] = useState(false);
    const edit = (patch: Partial<{ text: string; color: string; scope?: string }>): void => {
        setTouched(true);
        setForm((form) => ({...form, ...patch}));
    };
    const {text, color, scope} = form;

    const value = state.targets[type] ?? "";
    const existing = Boolean(memoOf(type, value));

    const submit = async (): Promise<void> => {
        // 공백만 있는 메모는 빈 메모로 본다. 그대로 저장하면 빈 "[ ]" 배지가 붙는다.
        const trimmed = text.trim();
        try {
            if (!trimmed) {
                if (existing) {
                    await removeMemo(type, value);
                    showToast("메모를 삭제했습니다.");
                } else showToast("메모 내용이 없어 저장하지 않았습니다.", "error");
            } else {
                await setMemo(type, value, {text: trimmed, color, gallery: scope});
                showToast("메모를 저장했습니다.");
            }
        } catch {
            showToast(SAVE_FAILED, "error");
        }

        closeMemo();
    };

    return (
        <ModalDialog onClose={closeMemo} focusOnOpen={input} className="sm:max-w-[400px]">
            <DialogHeader>
                <DialogTitle>메모</DialogTitle>
                <DialogDescription>
                    {MEMO_TYPE_NAMES[type]}: <strong className="text-foreground">{value}</strong>
                </DialogDescription>
            </DialogHeader>

            <SubmitForm onSubmit={submit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                    <ToggleGroup variant="outline" spacing={0} value={[type]} onValueChange={([next]) => {
                        if (!arrayIncludes(MEMO_TYPES, next)) return;
                        setType(next);
                        // 종류를 바꿀 때 입력한 적이 없으면 다른 대상의 저장된 메모로 채우고, 입력했으면 지우지 않는다.
                        if (!touched) setForm(prefill(next));
                    }}>
                        {MEMO_TYPES.filter((memoType) => state.targets[memoType]).map((memoType) => (
                            <ToggleGroupItem key={memoType} value={memoType}>
                                {MEMO_TYPE_NAMES[memoType]}
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>

                    <InputGroup>
                        <InputGroupAddon>
                            <ColorInput width={20} height={20} aria-label="색상" value={color} onChange={(ev) => edit({color: ev.target.value})}/>
                        </InputGroupAddon>
                        <InputGroupInput
                            ref={input}
                            maxLength={160}
                            aria-label="메모"
                            placeholder="메모를 입력해 주세요 (160자 제한)"
                            value={text}
                            onChange={(ev) => edit({text: ev.target.value})}
                        />
                        <InputGroupAddon align="inline-end">
                            <InputGroupButton size="icon-xs" aria-label="랜덤 색상" onClick={() => edit({color: randomColor()})}>
                                <Shuffle/>
                            </InputGroupButton>
                        </InputGroupAddon>
                    </InputGroup>

                    {gallery && (
                        <Field orientation="horizontal">
                            <Checkbox id={`${id}-scope`} checked={scope === gallery} onCheckedChange={(checked) => edit({scope: checked ? gallery : undefined})}/>
                            <FieldLabel htmlFor={`${id}-scope`}>이 갤러리에서만 ({gallery})</FieldLabel>
                        </Field>
                    )}
                    {scope && scope !== gallery && (
                        <p className="text-muted-foreground">지금은 {scope} 갤러리 전용 메모입니다.</p>
                    )}
                </div>

                <DialogFooter>
                    {existing && (
                        <Button type="button" variant="destructive" onClick={() => {
                            removeMemo(type, value).catch(() => showToast(SAVE_FAILED, "error"));
                            closeMemo();
                        }}>
                            삭제
                        </Button>
                    )}
                    <DialogClose render={<Button variant="outline"/>}>취소</DialogClose>
                    <Button type="submit">저장</Button>
                </DialogFooter>
            </SubmitForm>
        </ModalDialog>
    );
};

export const MemoDialog = () => {
    const memo = useUiStore((s) => s.memo);
    // 대상이 바뀌면 입력 초기값을 새로 잡도록 다시 마운트한다.
    return memo ? <MemoDialogInner key={JSON.stringify(memo)} state={memo}/> : null;
};
