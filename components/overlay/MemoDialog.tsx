import {Shuffle} from "lucide-preact";
import { useId, useRef, useState } from "preact/hooks";

import {ColorInput} from "@/components/ColorInput";
import {DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogTitle, ModalDialog, SubmitForm} from "@/components/dialogs";
import {MEMO_TYPE_NAMES, MEMO_TYPES} from "@/core/storage/items";
import type {MemoType} from "@/core/storage/types";
import {cn} from "cn";
import {ownMemo, randomColor, useMemosStore} from "@/stores/memos";
import {type MemoTargetState, selectedGallery, useUiStore} from "@/stores/ui";
import {SAVE_FAILED} from "@/utils/error";

const MemoDialogInner = ({state}: { state: MemoTargetState }) => {
    const closeMemo = useUiStore((s) => s.closeMemo);
    const showToast = useUiStore((s) => s.showToast);
    const memos = useMemosStore((s) => s.memos);
    const setMemo = useMemosStore((s) => s.setMemo);
    const removeMemo = useMemosStore((s) => s.removeMemo);
    const id = useId();
    const input = useRef<HTMLInputElement>(null);

    const gallery = selectedGallery(state.gallery);

    const memoOf = (memoType: MemoType, user: string) => ownMemo(memos[memoType], user);

    // 열거나 종류를 바꿀 때 기존 메모로 채운다 - scope는 저장된 갤러리를 그대로 가져온다.
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

    const save = async (write: Promise<void>, done: string): Promise<void> => {
        try {
            await write;
        } catch {
            showToast(SAVE_FAILED, "error");
            return;
        }
        showToast(done);
        closeMemo();
    };

    const remove = (): Promise<void> => save(removeMemo(type, value), "메모를 삭제했습니다.");

    const submit = async (): Promise<void> => {
        // 공백만 있는 메모는 빈 메모로 본다. 그대로 저장하면 빈 "[ ]" 배지가 붙는다.
        const trimmed = text.trim();
        if (trimmed) return save(setMemo(type, value, {text: trimmed, color, gallery: scope}), "메모를 저장했습니다.");
        if (existing) return remove();
        showToast("메모 내용이 없어 저장하지 않았습니다.", "error");
        closeMemo();
    };

    return (
        <ModalDialog onClose={closeMemo} focusOnOpen={input} className="sm:max-w-[400px]">
            <DialogHeader>
                <DialogTitle>메모</DialogTitle>
                <DialogDescription>
                    {MEMO_TYPE_NAMES[type]}: <strong className="text-base-content">{value}</strong>
                </DialogDescription>
            </DialogHeader>

            <SubmitForm onSubmit={submit}>
                <div className="flex flex-col gap-3">
                    <div role="group" aria-label="메모 대상" className="join">
                        {MEMO_TYPES.filter((memoType) => state.targets[memoType]).map((memoType) => (
                            <button key={memoType} type="button" aria-pressed={type === memoType}
                                    className={cn("btn btn-outline btn-sm join-item", type === memoType && "btn-active")}
                                    onClick={() => {
                                        setType(memoType);
                                        if (!touched) setForm(prefill(memoType));
                                    }}>
                                {MEMO_TYPE_NAMES[memoType]}
                            </button>
                        ))}
                    </div>

                    <div className="input h-auto flex-row items-center gap-2 py-1">
                        <ColorInput width={20} height={20} aria-label="색상" value={color} onChange={(ev) => edit({color: ev.currentTarget.value})}/>
                        <input
                            ref={input}
                            className="grow bg-transparent outline-none"
                            maxLength={160}
                            aria-label="메모"
                            placeholder="메모를 입력해 주세요 (160자 제한)"
                            value={text}
                            onInput={(ev) => edit({text: ev.currentTarget.value})}
                        />
                        <button type="button" className="btn btn-ghost btn-square btn-xs" aria-label="랜덤 색상" onClick={() => edit({color: randomColor()})}>
                            <Shuffle className="size-3"/>
                        </button>
                    </div>

                    {gallery && (
                        <div className="flex items-center gap-3">
                            <input type="checkbox" id={`${id}-scope`} className="checkbox"
                                   checked={scope === gallery}
                                   onChange={(ev) => edit({scope: ev.currentTarget.checked ? gallery : undefined})}/>
                            <label htmlFor={`${id}-scope`} className="text-sm font-medium leading-snug">이 갤러리에서만 ({gallery})</label>
                        </div>
                    )}
                    {scope && scope !== gallery && (
                        <p className="text-base-content/60">지금은 {scope} 갤러리 전용 메모입니다.</p>
                    )}
                </div>

                <DialogFooter>
                    {existing && (
                        <button type="button" className="btn btn-error" onClick={() => void remove()}>
                            삭제
                        </button>
                    )}
                    <DialogClose className="btn btn-outline">취소</DialogClose>
                    <button type="submit" className="btn btn-primary">저장</button>
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
