import {Dialog} from "radix-ui";
import {useEffect, useState} from "react";

import {DETECT_MODE_NAMES} from "@/core/storage/items";
import {composeExtra} from "@/features/block/request";
import type {BlockEntry, BlockType, DetectMode} from "@/core/storage/types";
import type {BlockInputFields} from "@/stores/blocks";

interface BlockDialogProps {
    open: boolean;
    type: BlockType;
    typeNames: Record<BlockType, string>;
    modeNames: Record<DetectMode, string>;
    /** 편집시 기존 항목 */
    initial?: BlockEntry | null;
    onClose: () => void;
    onSubmit: (fields: BlockInputFields) => void;
}

export const BlockDialog = ({open, type, typeNames, modeNames, initial, onClose, onSubmit}: BlockDialogProps) => {
    const [content, setContent] = useState("");
    const [isRegex, setIsRegex] = useState(false);
    const [gallery, setGallery] = useState("");
    const [mode, setMode] = useState<DetectMode | "">("");
    const [error, setError] = useState("");

    useEffect(() => {
        if (!open) return;

        setContent(initial?.content ?? "");
        setIsRegex(initial?.isRegex ?? false);
        setGallery(initial?.gallery ?? "");
        setMode(initial?.mode ?? "");
        setError("");
    }, [open, initial]);

    const submit = (): void => {
        if (!content.trim()) {
            setError(`${typeNames[type]} 값을 입력해주세요.`);
            return;
        }

        onSubmit({
            content: content.trim(),
            isRegex,
            mode: mode || undefined,
            gallery: gallery.trim() || undefined,
            extra: composeExtra({isRegex, gallery: gallery.trim() || undefined, mode: mode || undefined}, modeNames)
        });
    };

    return (
        <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
            <Dialog.Portal>
                <Dialog.Overlay className="refresher-overlay" />
                <Dialog.Content className="refresher-dialog">
                    <Dialog.Title className="refresher-dialog-title">
                        {typeNames[type]} 차단 {initial ? "수정" : "추가"}
                    </Dialog.Title>
                    <Dialog.Description className="refresher-dialog-desc">
                        {initial ? `${typeNames[type]} 항목을 수정합니다.` : `${typeNames[type]} 차단 항목을 추가합니다.`}
                    </Dialog.Description>

                    <div className="refresher-field">
                        <span className="refresher-field-label">값</span>
                        <input
                            className="refresher-input"
                            placeholder={`${typeNames[type]} 값을 입력하세요`}
                            value={content}
                            onChange={(event) => setContent(event.target.value)}
                            onKeyDown={(event) => event.key === "Enter" && submit()}
                            autoFocus
                        />
                    </div>

                    <div className="refresher-field">
                        <span className="refresher-field-label">정규식 사용</span>
                        <label className="refresher-check-row">
                            <input type="checkbox" className="refresher-check-plain" checked={isRegex} onChange={(event) => setIsRegex(event.target.checked)} />
                            정규식
                        </label>
                    </div>

                    <div className="refresher-field">
                        <span className="refresher-field-label">특정 갤러리 차단 (선택)</span>
                        <input className="refresher-input" placeholder="갤러리 ID" value={gallery} onChange={(event) => setGallery(event.target.value)} />
                    </div>

                    <div className="refresher-field">
                        <span className="refresher-field-label">차단 모드</span>
                        <select className="refresher-select" value={mode} onChange={(event) => setMode(event.target.value as DetectMode | "")}>
                            <option value="">기본값</option>
                            {Object.entries(modeNames).map(([key, label]) => (
                                <option key={key} value={key}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {error && <p className="refresher-error">{error}</p>}

                    <div className="refresher-dialog-actions">
                        <button type="button" className="refresher-button" onClick={onClose}>
                            취소
                        </button>
                        <button type="button" className="refresher-button refresher-primary" onClick={submit}>
                            {initial ? "수정" : "추가"}
                        </button>
                    </div>

                    <Dialog.Close asChild>
                        <button type="button" className="refresher-dialog-close" aria-label="닫기">
                            ×
                        </button>
                    </Dialog.Close>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};
