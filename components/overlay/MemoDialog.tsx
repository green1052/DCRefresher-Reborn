import {Button, Checkbox, Dialog, Flex, SegmentedControl, Text, TextField} from "@radix-ui/themes";
import {Shuffle} from "lucide-react";
import {useState} from "react";

import {SubmitForm} from "@/components/ConfirmDialog";
import {ModalDialog} from "@/components/ModalDialog";
import {queryString} from "@/core/http/urls";
import {MEMO_TYPE_NAMES, MEMO_TYPES} from "@/core/storage/items";
import type {MemoType} from "@/core/storage/types";
import {randomColor, useMemosStore} from "@/stores/memos";
import {type MemoTargetState, useUiStore} from "@/stores/ui";
import {SAVE_FAILED} from "@/utils/error";
import {arrayIncludes} from "@/utils/typed";

import {overlay} from "./shadow";

const MemoDialogInner = ({state}: { state: MemoTargetState }) => {
    const closeMemo = useUiStore((s) => s.closeMemo);
    const showToast = useUiStore((s) => s.showToast);
    const memos = useMemosStore((s) => s.memos);
    const setMemo = useMemosStore((s) => s.setMemo);
    const removeMemo = useMemosStore((s) => s.removeMemo);

    // 지금 보고 있는 갤러리. 이 갤러리에서만 보이는 메모로 저장할 때 쓴다.
    const gallery = queryString("id");

    // 닉네임이 toString·constructor·__proto__여도 프로토타입 값을 메모로 읽지 않게 자기 속성만 본다.
    const memoOf = (memoType: MemoType, user: string) => (Object.hasOwn(memos[memoType], user) ? memos[memoType][user] : undefined);

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
        // shadow root 안에서는 FocusScope가 autoFocus된 입력칸을 알아보지 못하고 첫 버튼으로 포커스를 옮기므로 막는다.
        <ModalDialog onClose={closeMemo} container={overlay.portal} maxWidth="400px" focusOnOpen="none">
            <Dialog.Title>메모</Dialog.Title>
            <Dialog.Description size="2" color="gray" mb="4">
                {MEMO_TYPE_NAMES[type]}: <Text weight="bold" highContrast>{value}</Text>
            </Dialog.Description>

            <SubmitForm onSubmit={submit}>
                <Flex direction="column" gap="3">
                    <SegmentedControl.Root value={type} onValueChange={(next) => {
                        if (!arrayIncludes(MEMO_TYPES, next)) return;
                        setType(next);
                        // 종류를 바꿀 때 입력한 적이 없으면 다른 대상의 저장된 메모로 채우고, 입력했으면 지우지 않는다.
                        if (!touched) setForm(prefill(next));
                    }}>
                        {MEMO_TYPES.filter((memoType) => state.targets[memoType]).map((memoType) => (
                            <SegmentedControl.Item key={memoType} value={memoType}>
                                {MEMO_TYPE_NAMES[memoType]}
                            </SegmentedControl.Item>
                        ))}
                    </SegmentedControl.Root>

                    <TextField.Root
                        maxLength={160}
                        aria-label="메모"
                        placeholder="메모를 입력해 주세요 (160자 제한)"
                        value={text}
                        onChange={(ev) => edit({text: ev.target.value})}
                        autoFocus
                    >
                        <TextField.Slot>
                            <input
                                type="color"
                                aria-label="색상"
                                value={color}
                                onChange={(ev) => edit({color: ev.target.value})}
                                style={{width: 20, height: 20, padding: 0, border: 0, background: "none", cursor: "pointer"}}
                            />
                        </TextField.Slot>
                        <TextField.Slot side="right">
                            <Button type="button" size="1" variant="ghost" color="gray" aria-label="랜덤 색상"
                                    onClick={() => edit({color: randomColor()})}>
                                <Shuffle size={12}/>
                            </Button>
                        </TextField.Slot>
                    </TextField.Root>

                    {gallery && (
                        <Text as="label" size="2">
                            <Flex gap="2" align="center">
                                <Checkbox checked={scope === gallery}
                                          onCheckedChange={(checked) => edit({scope: checked === true ? gallery : undefined})}/>
                                이 갤러리에서만 ({gallery})
                            </Flex>
                        </Text>
                    )}
                    {scope && scope !== gallery && (
                        <Text size="2" color="gray">지금은 {scope} 갤러리 전용 메모입니다.</Text>
                    )}
                </Flex>

                <Flex gap="3" justify="end" mt="4">
                    {existing && (
                        <Button type="button" variant="soft" color="red" onClick={() => {
                            removeMemo(type, value).catch(() => showToast(SAVE_FAILED, "error"));
                            closeMemo();
                        }}>
                            삭제
                        </Button>
                    )}
                    <Dialog.Close>
                        <Button variant="soft" color="gray">취소</Button>
                    </Dialog.Close>
                    <Button type="submit">저장</Button>
                </Flex>
            </SubmitForm>
        </ModalDialog>
    );
};

export const MemoDialog = () => {
    const memo = useUiStore((s) => s.memo);
    // 대상이 바뀌면 입력 초기값을 새로 잡도록 다시 마운트한다.
    return memo ? <MemoDialogInner key={JSON.stringify(memo)} state={memo}/> : null;
};
