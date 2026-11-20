import { useId, useState } from "preact/hooks";
import {Info} from "lucide-preact";

import {TooltipButton} from "@/components/WithTooltip";
import {DialogActions, DialogDescription, DialogHeader, DialogTitle, ModalDialog, SubmitForm} from "@/components/dialogs";
import {DETECT_MODE_NAMES, TYPE_NAMES} from "@/core/storage/items";
import type {BlockEntry, BlockType, DetectMode} from "@/core/storage/types";
import {blockKey, type BlockInputFields} from "@/core/block-list";
import {useBlocksStore} from "@/stores/blocks";
import {messageOf, SAVE_FAILED} from "@/utils/error";

import {RefresherSelect} from "../shared/RefresherSelect";

/** 모드마다 무엇을 가리는지. NOT_*는 한 유형의 불일치, 불포함 항목을 묶은 허용 목록이라(core/block.ts) 나머지가 모두 가려진다. */
export const DETECT_MODE_DESCRIPTIONS: Record<DetectMode, string> = {
    SAME: "값과 똑같으면 가립니다.",
    CONTAIN: "값이 들어 있으면 가립니다.",
    NOT_SAME: "값과 똑같은 것만 남기고 나머지를 모두 가립니다.\n불일치, 불포함 항목이 여럿이면 하나에만 맞아도 남깁니다.",
    NOT_CONTAIN: "값이 들어 있는 것만 남기고 나머지를 모두 가립니다.\n불일치, 불포함 항목이 여럿이면 하나에만 맞아도 남깁니다."
};

interface BlockDialogProps {
    type: BlockType;
    initial?: BlockEntry | null;
    onClose: () => void;
    onSubmit: (fields: BlockInputFields) => Promise<void>;
}

/** 초기값을 마운트 시점의 initial에서 잡으므로 열 때만 마운트한다. */
export const BlockDialog = ({type, initial, onClose, onSubmit}: BlockDialogProps) => {
    const [content, setContent] = useState(initial?.content ?? "");
    const [isRegex, setIsRegex] = useState(initial?.isRegex ?? false);
    const [gallery, setGallery] = useState(initial?.gallery ?? "");
    const [name, setName] = useState(initial?.extra ?? "");
    const [mode, setMode] = useState<DetectMode | "">(initial?.mode ?? "");
    const [error, setError] = useState("");
    const id = useId();

    const submit = async (): Promise<void> => {
        if (!content.trim()) {
            setError(`${TYPE_NAMES[type]} 값을 입력해 주세요.`);
            return;
        }
        // 틀린 정규식은 차단 검사에서 조용히 건너뛰어 아무것도 걸리지 않으므로 저장 전에 알린다.
        if (isRegex) {
            try {
                new RegExp(content.trim());
            } catch (e) {
                setError(`정규식이 올바르지 않습니다. ${messageOf(e)}`);
                return;
            }
        }

        const value = content.trim();

        // 같은 값, 갤러리 항목은 저장소에서 하나로 합쳐져 별명을 잃은 채 덮이므로 막는다. 고치려면 목록에서 수정한다.
        const key = blockKey({content: value, isRegex, gallery: gallery.trim() || undefined});
        if (useBlocksStore.getState().entries[type].some((entry) => entry.id !== initial?.id && blockKey(entry) === key)) {
            setError("이미 같은 차단 항목이 있습니다.");
            return;
        }

        try {
            await onSubmit({
                content: value,
                isRegex,
                mode: mode || undefined,
                gallery: gallery.trim() || undefined,
                // extra는 별명(디시콘 제목, 우클릭 차단 닉네임). 입력칸에서 고친다.
                extra: name.trim() || undefined
            });
        } catch {
            setError(SAVE_FAILED);
        }
    };

    return (
        <ModalDialog onClose={onClose} className="sm:max-w-120">
            <DialogHeader>
                <DialogTitle>{TYPE_NAMES[type]} 차단 {initial ? "수정" : "추가"}</DialogTitle>
                <DialogDescription>
                    {initial ? `${TYPE_NAMES[type]} 항목을 수정합니다.` : `${TYPE_NAMES[type]} 차단 항목을 추가합니다.`}
                </DialogDescription>
            </DialogHeader>

            <SubmitForm onSubmit={submit}>
                <div className="flex w-full flex-col gap-7">
                    <div className="flex w-full flex-col gap-3">
                        <label htmlFor={`${id}-content`} className="text-sm font-medium leading-snug">값</label>
                        <input id={`${id}-content`} className="input w-full" placeholder={`${TYPE_NAMES[type]} 값을 입력해 주세요`}
                               value={content} onInput={(ev) => setContent(ev.currentTarget.value)}/>
                    </div>

                    <div className="flex items-center gap-3">
                        <input type="checkbox" id={`${id}-regex`} className="checkbox checkbox-sm" checked={isRegex}
                               onChange={(ev) => setIsRegex(ev.currentTarget.checked)}/>
                        <label htmlFor={`${id}-regex`} className="text-sm font-medium leading-snug">정규식</label>
                    </div>

                    <div className="flex w-full flex-col gap-3">
                        <label htmlFor={`${id}-name`} className="text-sm font-medium leading-snug">정보 (선택)</label>
                        <input id={`${id}-name`} className="input w-full" placeholder="목록에 보일 정보. 비우면 값으로 보입니다."
                               value={name} onInput={(ev) => setName(ev.currentTarget.value)}/>
                    </div>

                    <div className="flex w-full flex-col gap-3">
                        <label htmlFor={`${id}-gallery`} className="text-sm font-medium leading-snug">특정 갤러리 차단 (선택)</label>
                        <input id={`${id}-gallery`} className="input w-full" placeholder="갤러리 ID" value={gallery}
                               onInput={(ev) => setGallery(ev.currentTarget.value)}/>
                    </div>

                    <div className="flex w-full flex-col gap-3">
                        <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium leading-snug">차단 모드</span>
                            <TooltipButton tip={mode ? DETECT_MODE_DESCRIPTIONS[mode] : "기본 모드를 따릅니다."}
                                           variant="ghost" size="icon-xs">
                                <Info className="size-3.5"/>
                            </TooltipButton>
                        </div>
                        <RefresherSelect value={mode} aria-label="차단 모드" onChange={setMode}
                                         options={{"": "기본값", ...DETECT_MODE_NAMES}}/>
                    </div>

                    {error && <p role="alert" className="text-sm text-error">{error}</p>}
                </div>

                <DialogActions>
                    <button type="submit" className="btn btn-primary">{initial ? "수정" : "추가"}</button>
                </DialogActions>
            </SubmitForm>
        </ModalDialog>
    );
};
