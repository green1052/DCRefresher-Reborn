import {Dialog} from "radix-ui";
import {useEffect, useState} from "react";

import {MEMO_TYPE_NAMES, MEMO_TYPES} from "@/core/storage/items";
import type {MemoType} from "@/core/storage/types";
import {useMemosStore} from "@/stores/memos";
import {type MemoTargetState, useUiStore} from "@/stores/ui";

const TYPE_LABELS: Record<MemoType, string> = {NICK: "닉네임", UID: "아이디", IP: "IP"};

const randomColor = (): string => `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0")}`;

interface MemoDialogProps {
    state: MemoTargetState;
}

const MemoDialogInner = ({state}: MemoDialogProps) => {
    const closeMemo = useUiStore((s) => s.closeMemo);
    const showToast = useUiStore((s) => s.showToast);
    const memos = useMemosStore((s) => s.memos);
    const setMemo = useMemosStore((s) => s.setMemo);
    const removeMemo = useMemosStore((s) => s.removeMemo);

    const [type, setType] = useState<MemoType>(state.initialType);
    const [text, setText] = useState("");
    const [color, setColor] = useState(() => randomColor());

    // 열릴 때/타입 전환시 기존 메모로 프리필
    useEffect(() => {
        const existing = memos[type][state.targets[type] ?? ""];
        setText(existing?.text ?? "");
        setColor(existing?.color ?? randomColor());
        // 타입 전환/마운트 시에만 적용
    }, [type]);

    const value = state.targets[type] ?? "";

    const switchType = (next: MemoType): void => {
        if (next === type || !state.targets[next]) return;
        setType(next);
    };

    const submit = async (): Promise<void> => {
        if (!text) {
            const existing = memos[type][value];
            if (existing) await removeMemo(type, value);
            else showToast(`해당하는 ${MEMO_TYPE_NAMES[type]}을(를) 가진 사용자 메모가 없습니다.`, "error");
        } else {
            await setMemo(type, value, {text, color});
            showToast(`${MEMO_TYPE_NAMES[type]} ${value}에 메모를 추가했습니다.`);
        }

        closeMemo();
    };

    const existing = Boolean(memos[type][value]);

    return (
        <Dialog.Portal>
            <Dialog.Overlay className="refresher-overlay"/>
            <Dialog.Content className="refresher-dialog">
                <Dialog.Title className="refresher-dialog-title">메모 추가</Dialog.Title>
                <Dialog.Description className="refresher-dialog-desc">
                    {MEMO_TYPE_NAMES[type]}: {value}
                </Dialog.Description>

                <div className="refresher-segment">
                    {MEMO_TYPES.map((memoType) => (
                        <button
                            key={memoType}
                            type="button"
                            className="refresher-segment-item"
                            data-active={type === memoType || undefined}
                            disabled={!state.targets[memoType]}
                            onClick={() => switchType(memoType)}
                        >
                            {TYPE_LABELS[memoType]}
                        </button>
                    ))}
                </div>

                <input
                    className="refresher-input"
                    maxLength={160}
                    placeholder="메모를 입력해주세요 (160자 제한)"
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && void submit()}
                    autoFocus
                />

                <div className="refresher-color-row">
                    <input type="color" className="refresher-color" value={color}
                           onChange={(event) => setColor(event.target.value)}/>
                    <button type="button" className="refresher-button" onClick={() => setColor(randomColor())}>
                        랜덤
                    </button>
                </div>

                <div className="refresher-dialog-actions">
                    {existing && (
                        <button
                            type="button"
                            className="refresher-button refresher-danger"
                            onClick={() => {
                                void removeMemo(type, value);
                                closeMemo();
                            }}
                        >
                            삭제
                        </button>
                    )}
                    <button type="button" className="refresher-button refresher-primary" onClick={() => void submit()}>
                        추가
                    </button>
                </div>

                <Dialog.Close asChild>
                    <button type="button" className="refresher-dialog-close" aria-label="닫기">
                        ×
                    </button>
                </Dialog.Close>
            </Dialog.Content>
        </Dialog.Portal>
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
