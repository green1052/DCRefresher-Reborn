import {Plus, X} from "lucide-react";
import {IconButton} from "@radix-ui/themes";
import {useState} from "react";

import {BlockDialog} from "@/components/BlockDialog";
import {ConfirmDialog} from "@/components/ConfirmDialog";
import {RefresherSelect} from "@/components/RefresherSelect";
import {BLOCK_TYPES, TYPE_NAMES, DETECT_MODE_NAMES} from "@/core/storage/items";
import type {BlockEntry, BlockType, DetectMode} from "@/core/storage/types";
import type {BlockInputFields} from "@/stores/blocks";
import {useBlocksStore} from "@/stores/blocks";

/** 디시콘 이미지 (묶음 정규식이면 첫 코드) */
const dcconImage = (entry: BlockEntry): string => {
    const code = entry.isRegex ? (entry.content.match(/^\^\((\w+)\|/)?.[1] ?? entry.content) : entry.content;
    return `https://image.dcinside.com/dccon.php?no=${code}`;
};

export function BlockTab() {
    const entries = useBlocksStore((state) => state.entries);
    const defaults = useBlocksStore((state) => state.defaults);
    const addEntry = useBlocksStore((state) => state.addEntry);
    const updateEntry = useBlocksStore((state) => state.updateEntry);
    const removeEntry = useBlocksStore((state) => state.removeEntry);
    const clearType = useBlocksStore((state) => state.clearType);
    const setDefault = useBlocksStore((state) => state.setDefault);

    const [dialog, setDialog] = useState<{type: BlockType; initial: BlockEntry | null} | null>(null);
    const [clearConfirm, setClearConfirm] = useState<BlockType | null>(null);

    const handleSubmit = async (fields: BlockInputFields): Promise<void> => {
        if (!dialog) return;

        // 디시콘은 생성시 부여된 별명("제목 [패키지번호]")을 유지
        const next = dialog.type === "DCCON" && dialog.initial?.extra ? {...fields, extra: dialog.initial.extra} : fields;

        if (dialog.initial) await updateEntry(dialog.type, dialog.initial.id, next);
        else await addEntry(dialog.type, next);

        setDialog(null);
    };

    return (
        <div>
            <h2 className="refresher-section-title">차단 모드</h2>
            <p className="refresher-section-desc">기본 차단 판별 방식입니다. 개별 항목의 모드가 우선합니다.</p>

            {BLOCK_TYPES.map((type) => (
                <div key={`mode-${type}`} className="refresher-field">
                    <span className="refresher-field-label">{TYPE_NAMES[type]}</span>
                    <RefresherSelect value={defaults[type]} onChange={(next) => void setDefault(type, next as DetectMode)} options={Object.entries(DETECT_MODE_NAMES)} />
                </div>
            ))}

            {BLOCK_TYPES.map((type) => {
                const list = entries[type];

                return (
                    <section key={type} className="refresher-section">
                        <header className="refresher-section-head">
                            <h3>
                                {TYPE_NAMES[type]} ({list.length}개)
                            </h3>
                            <span className="refresher-section-actions">
                                <IconButton variant="ghost" color="gray" size="1" title="추가" onClick={() => setDialog({type, initial: null})}>
                                    <Plus size={16} />
                                </IconButton>
                                <IconButton
                                    variant="ghost"
                                    color="gray"
                                    size="1"
                                    title="전체 삭제"
                                    disabled={list.length === 0}
                                    onClick={() => setClearConfirm(type)}
                                >
                                    <X size={14} />
                                </IconButton>
                            </span>
                        </header>

                        {list.length === 0 ? (
                            <p className="empty">차단된 {TYPE_NAMES[type]} 없음</p>
                        ) : (
                            <div className="refresher-chip-list">
                                {list.map((entry) => (
                                    <span key={entry.id} className="refresher-chip">
                                        {type === "DCCON" ? (
                                            <button type="button" className="refresher-chip-text" onClick={() => setDialog({type, initial: entry})}>
                                                <img className="refresher-chip-image" src={dcconImage(entry)} alt={entry.extra ?? entry.content} />
                                            </button>
                                        ) : (
                                            <button type="button" className="refresher-chip-text" onClick={() => setDialog({type, initial: entry})}>
                                                {entry.content}
                                                {entry.extra ? ` (${entry.extra})` : ""}
                                                {entry.gallery ? ` (${entry.gallery})` : ""}
                                            </button>
                                        )}
                                        <IconButton
                                            variant="ghost"
                                            color="gray"
                                            size="1"
                                            title="삭제"
                                            onClick={() => void removeEntry(type, entry.id)}
                                        >
                                            <X size={12} />
                                        </IconButton>
                                    </span>
                                ))}
                            </div>
                        )}
                    </section>
                );
            })}

            {dialog && (
                <BlockDialog
                    open
                    type={dialog.type}
                    typeNames={TYPE_NAMES}
                    modeNames={DETECT_MODE_NAMES}
                    initial={dialog.initial}
                    onClose={() => setDialog(null)}
                    onSubmit={handleSubmit}
                />
            )}

            <ConfirmDialog
                open={clearConfirm !== null}
                title={`${clearConfirm ? TYPE_NAMES[clearConfirm] : ""} 차단 목록을 모두 삭제할까요?`}
                confirmLabel="삭제"
                danger
                onConfirm={() => {
                    if (clearConfirm) void clearType(clearConfirm);
                    setClearConfirm(null);
                }}
                onClose={() => setClearConfirm(null)}
            />
        </div>
    );
}
