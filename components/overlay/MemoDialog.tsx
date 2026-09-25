import {Button, Checkbox, Dialog, Flex, SegmentedControl, Text, TextField} from "@radix-ui/themes";
import {Shuffle} from "lucide-react";
import {useEffect, useState} from "react";

import {queryString} from "@/core/http/urls";
import {MEMO_TYPE_NAMES, MEMO_TYPES} from "@/core/storage/items";
import type {MemoType} from "@/core/storage/types";
import {useMemosStore} from "@/stores/memos";
import {type MemoTargetState, useUiStore} from "@/stores/ui";

import {overlay} from "./shadow";

const TYPE_LABELS: Record<MemoType, string> = {NICK: "닉네임", UID: "아이디", IP: "IP"};

const randomColor = (): string => `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0")}`;

const MemoDialogInner = ({state}: { state: MemoTargetState }) => {
    const closeMemo = useUiStore((s) => s.closeMemo);
    const showToast = useUiStore((s) => s.showToast);
    const memos = useMemosStore((s) => s.memos);
    const setMemo = useMemosStore((s) => s.setMemo);
    const removeMemo = useMemosStore((s) => s.removeMemo);

    const [type, setType] = useState<MemoType>(state.initialType);
    const [text, setText] = useState("");
    const [color, setColor] = useState(() => randomColor());
    // 지금 보고 있는 갤러리 — 여기서만 보이는 메모로 저장할 수 있다
    const gallery = queryString("id");
    const [onlyHere, setOnlyHere] = useState(false);

    // 열릴 때/타입 전환시 기존 메모로 프리필
    useEffect(() => {
        const existing = memos[type][state.targets[type] ?? ""];
        setText(existing?.text ?? "");
        setColor(existing?.color ?? randomColor());
        setOnlyHere(Boolean(existing?.gallery));
        // 타입 전환/마운트 시에만 적용
    }, [type]);

    const value = state.targets[type] ?? "";
    const existing = Boolean(memos[type][value]);

    const submit = async (): Promise<void> => {
        if (!text) {
            if (existing) await removeMemo(type, value);
            else showToast(`해당하는 ${MEMO_TYPE_NAMES[type]}을(를) 가진 사용자 메모가 없습니다.`, "error");
        } else {
            await setMemo(type, value, {text, color, gallery: onlyHere && gallery ? gallery : undefined});
            showToast(`${MEMO_TYPE_NAMES[type]} ${value}에 메모를 추가했습니다.`);
        }

        closeMemo();
    };

    return (
        <Dialog.Content container={overlay.portal} maxWidth="400px">
            <Dialog.Title>메모</Dialog.Title>
            <Dialog.Description size="2" color="gray" mb="4">
                {MEMO_TYPE_NAMES[type]}: <Text weight="bold" highContrast>{value}</Text>
            </Dialog.Description>

            <Flex direction="column" gap="3">
                <SegmentedControl.Root value={type} onValueChange={(next) => {
                    if (state.targets[next as MemoType]) setType(next as MemoType);
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
                    onChange={(event) => setText(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && void submit()}
                    autoFocus
                >
                    <TextField.Slot>
                        <input
                            type="color"
                            aria-label="색상"
                            value={color}
                            onChange={(event) => setColor(event.target.value)}
                            style={{width: 20, height: 20, padding: 0, border: 0, background: "none", cursor: "pointer"}}
                        />
                    </TextField.Slot>
                    <TextField.Slot side="right">
                        <Button size="1" variant="ghost" color="gray" aria-label="랜덤 색상"
                                onClick={() => setColor(randomColor())}>
                            <Shuffle size={12}/>
                        </Button>
                    </TextField.Slot>
                </TextField.Root>

                {gallery && (
                    <Text as="label" size="2">
                        <Flex gap="2" align="center">
                            <Checkbox checked={onlyHere} onCheckedChange={(checked) => setOnlyHere(checked === true)}/>
                            이 갤러리에서만 ({gallery})
                        </Flex>
                    </Text>
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
