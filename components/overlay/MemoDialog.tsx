import {Button, Checkbox, Dialog, Flex, SegmentedControl, Text, TextField} from "@radix-ui/themes";
import {Shuffle} from "lucide-react";
import {useState} from "react";

import {queryString} from "@/core/http/urls";
import {MEMO_TYPE_NAMES, MEMO_TYPES} from "@/core/storage/items";
import type {MemoType} from "@/core/storage/types";
import {randomColor, useMemosStore} from "@/stores/memos";
import {type MemoTargetState, useUiStore} from "@/stores/ui";

import {overlay} from "./shadow";

const TYPE_LABELS: Record<MemoType, string> = {NICK: "닉네임", UID: "아이디", IP: "IP"};

const MemoDialogInner = ({state}: { state: MemoTargetState }) => {
    const closeMemo = useUiStore((s) => s.closeMemo);
    const showToast = useUiStore((s) => s.showToast);
    const memos = useMemosStore((s) => s.memos);
    const setMemo = useMemosStore((s) => s.setMemo);
    const removeMemo = useMemosStore((s) => s.removeMemo);

    // 지금 보고 있는 갤러리 — 여기서만 보이는 메모로 저장할 수 있다
    const gallery = queryString("id");

    // 닉네임이 toString·constructor·__proto__여도 프로토타입 값을 메모로 읽지 않게 자기 속성만 본다
    const memoOf = (memoType: MemoType, user: string) => (Object.hasOwn(memos[memoType], user) ? memos[memoType][user] : undefined);

    // 열릴 때/타입 전환시 기존 메모로 프리필.
    // 범위(scope)는 체크 여부가 아니라 저장된 갤러리 그대로 — 다른 갤러리 전용 메모가 여기서 저장돼도 범위가 바뀌지 않게
    const prefill = (memoType: MemoType): { text: string; color: string; scope?: string } => {
        const memo = memoOf(memoType, state.targets[memoType] ?? "");
        return {text: memo?.text ?? "", color: memo?.color ?? randomColor(), scope: memo?.gallery};
    };

    const [type, setType] = useState<MemoType>(state.initialType);
    const [form, setForm] = useState(() => prefill(state.initialType));
    const {text, color, scope} = form;

    const value = state.targets[type] ?? "";
    const existing = Boolean(memoOf(type, value));

    const submit = async (): Promise<void> => {
        // 공백만 있는 메모는 빈 메모로 — 저장하면 빈 "[ ]" 배지가 붙는다
        const trimmed = text.trim();
        if (!trimmed) {
            if (existing) await removeMemo(type, value);
            else showToast(`해당하는 ${MEMO_TYPE_NAMES[type]}을(를) 가진 사용자 메모가 없습니다.`, "error");
        } else {
            await setMemo(type, value, {text: trimmed, color, gallery: scope});
            showToast(`${MEMO_TYPE_NAMES[type]} ${value}에 메모를 추가했습니다.`);
        }

        closeMemo();
    };

    return (
        // 섀도 루트 안에선 FocusScope가 포커스를 못 알아보고 첫 버튼으로 옮겨 autoFocus를 덮는다
        <Dialog.Content container={overlay.portal} maxWidth="400px" onOpenAutoFocus={(ev) => ev.preventDefault()}>
            <Dialog.Title>메모</Dialog.Title>
            <Dialog.Description size="2" color="gray" mb="4">
                {MEMO_TYPE_NAMES[type]}: <Text weight="bold" highContrast>{value}</Text>
            </Dialog.Description>

            <Flex direction="column" gap="3">
                <SegmentedControl.Root value={type} onValueChange={(next) => {
                    if (!state.targets[next as MemoType]) return;
                    setType(next as MemoType);
                    setForm(prefill(next as MemoType));
                }}>
                    {MEMO_TYPES.filter((memoType) => state.targets[memoType]).map((memoType) => (
                        <SegmentedControl.Item key={memoType} value={memoType}>
                            {TYPE_LABELS[memoType]}
                        </SegmentedControl.Item>
                    ))}
                </SegmentedControl.Root>

                <TextField.Root
                    maxLength={160}
                    placeholder="메모를 입력해주세요 (160자 제한)"
                    value={text}
                    onChange={(ev) => setForm({...form, text: ev.target.value})}
                    // 한글 조합 중 Enter는 keydown이 조합 확정용까지 두 번 와서 두 번 저장된다
                    onKeyDown={(ev) => ev.key === "Enter" && !ev.nativeEvent.isComposing && void submit()}
                    autoFocus
                >
                    <TextField.Slot>
                        <input
                            type="color"
                            aria-label="색상"
                            value={color}
                            onChange={(ev) => setForm({...form, color: ev.target.value})}
                            style={{width: 20, height: 20, padding: 0, border: 0, background: "none", cursor: "pointer"}}
                        />
                    </TextField.Slot>
                    <TextField.Slot side="right">
                        <Button size="1" variant="ghost" color="gray" aria-label="랜덤 색상"
                                onClick={() => setForm({...form, color: randomColor()})}>
                            <Shuffle size={12}/>
                        </Button>
                    </TextField.Slot>
                </TextField.Root>

                {gallery && (
                    <Text as="label" size="2">
                        <Flex gap="2" align="center">
                            <Checkbox checked={scope === gallery}
                                      onCheckedChange={(checked) => setForm({...form, scope: checked === true ? gallery : undefined})}/>
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
                    <Button variant="soft" color="red" onClick={() => {
                        void removeMemo(type, value);
                        closeMemo();
                    }}>
                        삭제
                    </Button>
                )}
                <Dialog.Close>
                    <Button variant="soft" color="gray">취소</Button>
                </Dialog.Close>
                <Button onClick={() => void submit()}>저장</Button>
            </Flex>
        </Dialog.Content>
    );
};

export const MemoDialog = () => {
    const memo = useUiStore((s) => s.memo);
    const closeMemo = useUiStore((s) => s.closeMemo);
    if (!memo) return null;

    return (
        <Dialog.Root open onOpenChange={(open) => !open && closeMemo()}>
            <MemoDialogInner key={JSON.stringify(memo)} state={memo}/>
        </Dialog.Root>
    );
};
