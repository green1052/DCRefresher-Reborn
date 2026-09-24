import {Plus, X} from "lucide-react";
import {useState} from "react";

import {RefresherSelect} from "@/components/RefresherSelect";
import {MEMO_TYPES, MEMO_TYPE_NAMES} from "@/core/storage/items";
import type {MemoEntry, MemoType} from "@/core/storage/types";
import {useMemosStore} from "@/stores/memos";

const MEMO_TARGET = "https://dcrefresher.green1052.com/utils/convert-memo";

const randomColor = (): string => `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0")}`;

interface MemoFormState {
    type: MemoType;
    user: string;
    text: string;
    color: string;
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

        await onSubmit(state);
        onClose();
    };

    return (
        <div className="refresher-overlay" onMouseDown={onClose}>
            <div className="refresher-dialog" onMouseDown={(event) => event.stopPropagation()}>
                <h3 className="refresher-dialog-title">메모 {editing ? "수정" : "추가"}</h3>

                <div className="refresher-field">
                    <span className="refresher-field-label">종류</span>
                    <RefresherSelect
                        value={state.type}
                        disabled={editing}
                        onChange={(next) => setState((prev) => ({...prev, type: next as MemoType}))}
                        options={MEMO_TYPES.map((type) => [type, MEMO_TYPE_NAMES[type]] as [string, string])}
                    />
                </div>

                <div className="refresher-field">
                    <span className="refresher-field-label">대상</span>
                    <input
                        className="refresher-input"
                        placeholder="유저, 닉네임 또는 IP"
                        value={state.user}
                        disabled={editing}
                        onChange={(event) => setState((prev) => ({...prev, user: event.target.value.trim()}))}
                    />
                </div>

                <div className="refresher-field">
                    <span className="refresher-field-label">메모</span>
                    <input
                        className="refresher-input"
                        maxLength={160}
                        placeholder="메모를 입력해주세요 (160자 제한)"
                        value={state.text}
                        onChange={(event) => setState((prev) => ({...prev, text: event.target.value}))}
                        onKeyDown={(event) => event.key === "Enter" && void submit()}
                        autoFocus
                    />
                </div>

                <div className="refresher-field">
                    <span className="refresher-field-label">색상</span>
                    <span className="refresher-color-row">
                        <input
                            type="color"
                            className="refresher-color"
                            value={state.color}
                            onChange={(event) => setState((prev) => ({...prev, color: event.target.value}))}
                        />
                        <button type="button" className="refresher-button" onClick={() => setState((prev) => ({...prev, color: randomColor()}))}>
                            랜덤
                        </button>
                    </span>
                </div>

                {error && <p className="refresher-error">{error}</p>}

                <div className="refresher-dialog-actions">
                    <button type="button" className="refresher-button" onClick={onClose}>
                        취소
                    </button>
                    <button type="button" className="refresher-button refresher-primary" onClick={() => void submit()}>
                        {editing ? "수정" : "추가"}
                    </button>
                </div>

                <button type="button" className="refresher-dialog-close" aria-label="닫기" onClick={onClose}>
                    ×
                </button>
            </div>
        </div>
    );
};

export function MemoTab() {
    const memos = useMemosStore((state) => state.memos);
    const setMemo = useMemosStore((state) => state.setMemo);
    const removeMemo = useMemosStore((state) => state.removeMemo);
    const clearType = useMemosStore((state) => state.clearType);

    const [form, setForm] = useState<MemoFormState | null>(null);

    return (
        <div>
            <h2 className="refresher-section-title">데이터 관리</h2>
            <p className="refresher-section-desc">
                <button type="button" className="refresher-link" onClick={() => window.open(MEMO_TARGET, "_blank")}>
                    메모 변환
                </button>
            </p>

            {MEMO_TYPES.map((type) => {
                const map = memos[type];

                return (
                    <section key={type} className="refresher-section">
                        <header className="refresher-section-head">
                            <h3>
                                {MEMO_TYPE_NAMES[type]} ({Object.keys(map).length}개)
                            </h3>
                            <span className="refresher-section-actions">
                                <button
                                    type="button"
                                    className="refresher-icon-button"
                                    title="추가"
                                    onClick={() => setForm({type, user: "", text: "", color: randomColor()})}
                                >
                                    <Plus size={16} />
                                </button>
                                <button
                                    type="button"
                                    className="refresher-icon-button"
                                    title="전체 삭제"
                                    disabled={Object.keys(map).length === 0}
                                    onClick={() => {
                                        if (confirm(`${MEMO_TYPE_NAMES[type]} 메모를 모두 삭제할까요?`)) void clearType(type);
                                    }}
                                >
                                    <X size={14} />
                                </button>
                            </span>
                        </header>

                        {Object.keys(map).length === 0 ? (
                            <p className="empty">{MEMO_TYPE_NAMES[type]} 메모 없음</p>
                        ) : (
                            <div className="refresher-chip-list">
                                {Object.entries(map).map(([user, entry]) => (
                                    <span key={user} className="refresher-chip">
                                        <button
                                            type="button"
                                            className="refresher-chip-text"
                                            title={entry.text}
                                            onClick={() => setForm({type, user, text: entry.text, color: entry.color})}
                                        >
                                            {user} ({entry.text.slice(0, 10)})
                                        </button>
                                        <button
                                            type="button"
                                            className="refresher-chip-remove"
                                            title="삭제"
                                            onClick={() => void removeMemo(type, user)}
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </section>
                );
            })}

            {form && (
                <MemoFormDialog
                    initial={form}
                    onClose={() => setForm(null)}
                    onSubmit={(next) => setMemo(next.type, next.user, {text: next.text, color: next.color})}
                />
            )}
        </div>
    );
}

export type {MemoEntry};
