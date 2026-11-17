import {useId, useState} from "react";
import {Info} from "lucide-react";

import {TooltipButton} from "@/components/WithTooltip";
import {DialogActions, ModalDialog, SubmitForm} from "@/components/dialogs";
import {Button} from "@/components/ui/button";
import {Checkbox} from "@/components/ui/checkbox";
import {DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Field, FieldError, FieldGroup, FieldLabel} from "@/components/ui/field";
import {Input} from "@/components/ui/input";
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
        <ModalDialog onClose={onClose} className="sm:max-w-[480px]">
            <DialogHeader>
                <DialogTitle>{TYPE_NAMES[type]} 차단 {initial ? "수정" : "추가"}</DialogTitle>
                <DialogDescription>
                    {initial ? `${TYPE_NAMES[type]} 항목을 수정합니다.` : `${TYPE_NAMES[type]} 차단 항목을 추가합니다.`}
                </DialogDescription>
            </DialogHeader>

            <SubmitForm onSubmit={submit}>
                <FieldGroup>
                    <Field>
                        <FieldLabel htmlFor={`${id}-content`}>값</FieldLabel>
                        <Input id={`${id}-content`} placeholder={`${TYPE_NAMES[type]} 값을 입력해 주세요`} value={content}
                               onChange={(ev) => setContent(ev.target.value)}/>
                    </Field>

                    <Field orientation="horizontal">
                        <Checkbox id={`${id}-regex`} checked={isRegex} onCheckedChange={setIsRegex}/>
                        <FieldLabel htmlFor={`${id}-regex`}>정규식</FieldLabel>
                    </Field>

                    <Field>
                        <FieldLabel htmlFor={`${id}-name`}>정보 (선택)</FieldLabel>
                        <Input id={`${id}-name`} placeholder="목록에 보일 정보. 비우면 값으로 보입니다." value={name}
                               onChange={(ev) => setName(ev.target.value)}/>
                    </Field>

                    <Field>
                        <FieldLabel htmlFor={`${id}-gallery`}>특정 갤러리 차단 (선택)</FieldLabel>
                        <Input id={`${id}-gallery`} placeholder="갤러리 ID" value={gallery} onChange={(ev) => setGallery(ev.target.value)}/>
                    </Field>

                    <Field>
                        <div className="flex items-center gap-1.5">
                            <FieldLabel>차단 모드</FieldLabel>
                            <TooltipButton tip={mode ? DETECT_MODE_DESCRIPTIONS[mode] : "기본 차단 모드를 따릅니다."}
                                           variant="ghost" size="icon-xs">
                                <Info className="size-3.5"/>
                            </TooltipButton>
                        </div>
                        <RefresherSelect value={mode} aria-label="차단 모드" onChange={setMode}
                                         options={{"": "기본값", ...DETECT_MODE_NAMES}}/>
                    </Field>

                    {error && <FieldError role="alert">{error}</FieldError>}
                </FieldGroup>

                <DialogActions>
                    <Button type="submit">{initial ? "수정" : "추가"}</Button>
                </DialogActions>
            </SubmitForm>
        </ModalDialog>
    );
};
