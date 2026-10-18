import {useId, useState} from "react";

import {DialogActions, ModalDialog, SubmitForm} from "@/components/dialogs";
import {Button} from "@/components/ui/button";
import {Checkbox} from "@/components/ui/checkbox";
import {DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel} from "@/components/ui/field";
import {Input} from "@/components/ui/input";
import {DETECT_MODE_NAMES, TYPE_NAMES} from "@/core/storage/items";
import type {BlockEntry, BlockType, DetectMode} from "@/core/storage/types";
import {blockKey, type BlockInputFields, useBlocksStore} from "@/stores/blocks";
import {messageOf, SAVE_FAILED} from "@/utils/error";

import {RefresherSelect} from "./RefresherSelect";

/** 모드마다 무엇을 가리는지. NOT_*는 한 유형의 불일치·불포함 항목을 묶은 허용 목록이라(core/block.ts) 나머지가 모두 가려진다. */
export const DETECT_MODE_DESCRIPTIONS: Record<DetectMode, string> = {
    SAME: "값과 똑같으면 가립니다.",
    CONTAIN: "값이 들어 있으면 가립니다.",
    NOT_SAME: "값과 똑같은 것만 남기고 나머지를 모두 가립니다. 불일치·불포함 항목이 여럿이면 하나라도 맞으면 남깁니다.",
    NOT_CONTAIN: "값이 들어 있는 것만 남기고 나머지를 모두 가립니다. 불일치·불포함 항목이 여럿이면 하나라도 맞으면 남깁니다."
};

const IMAGE_HINT = "보통은 본문 이미지를 우클릭해 '이 이미지 차단'으로 넣습니다.";

interface BlockDialogProps {
    type: BlockType;
    /** 수정할 기존 항목. 없으면 추가. */
    initial?: BlockEntry | null;
    onClose: () => void;
    onSubmit: (fields: BlockInputFields) => Promise<void>;
}

/** 차단 항목 추가/수정 다이얼로그. 입력 초기값을 마운트 시점의 initial에서 잡으므로 열 때만 마운트한다. */
export const BlockDialog = ({type, initial, onClose, onSubmit}: BlockDialogProps) => {
    const [content, setContent] = useState(initial?.content ?? "");
    const [isRegex, setIsRegex] = useState(type !== "IMAGE" && (initial?.isRegex ?? false));
    const [gallery, setGallery] = useState(initial?.gallery ?? "");
    const [mode, setMode] = useState<DetectMode | "">(initial?.mode ?? "");
    const [error, setError] = useState("");
    const defaultMode = useBlocksStore((state) => state.defaults[type]);
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

        // 이미지는 파일 해시(소문자 16진수 SHA-256)와 견주므로(core/block.ts의 isImageBlocked) 다른 글자는 어떤 이미지도 가리지 못한다.
        const isImageHash = type === "IMAGE" && !isRegex;
        const value = isImageHash ? content.trim().toLowerCase() : content.trim();
        if (isImageHash && !/^[0-9a-f]{64}$/.test(value)) {
            setError(`이미지 값은 파일 해시(SHA-256, 16진수 64자)여야 합니다. ${IMAGE_HINT}`);
            return;
        }

        // 같은 값·갤러리 항목은 저장소에서 하나로 합쳐져 별명·지문을 잃은 채 덮이므로 막는다. 고치려면 목록에서 수정한다.
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
                // extra는 별명(우클릭 차단 닉네임, 디시콘 제목)이라 입력칸 없이 그대로 유지한다.
                extra: initial?.extra,
                // 이미지의 비슷한 이미지 지문은 그 파일 해시(content)의 것이다. 내용을 바꾸면 버린다.
                ...(value === initial?.content ? {similar: initial.similar, frames: initial.frames} : {similar: undefined, frames: undefined})
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
                    {type === "IMAGE" && ` 값은 파일 해시(SHA-256)입니다. ${IMAGE_HINT}`}
                </DialogDescription>
            </DialogHeader>

            <SubmitForm onSubmit={submit} className="flex flex-col gap-4">
                <FieldGroup>
                    <Field>
                        <FieldLabel htmlFor={`${id}-content`}>값</FieldLabel>
                        <Input id={`${id}-content`} placeholder={`${TYPE_NAMES[type]} 값을 입력해 주세요`} value={content}
                               onChange={(ev) => setContent(ev.target.value)}/>
                    </Field>

                    {/* 이미지 값은 파일 해시라 정규식으로 고를 게 없다. 짧은 식은 아무 이미지나 걸린다. */}
                    {type !== "IMAGE" && (
                        <Field orientation="horizontal">
                            <Checkbox id={`${id}-regex`} checked={isRegex} onCheckedChange={setIsRegex}/>
                            <FieldLabel htmlFor={`${id}-regex`}>정규식</FieldLabel>
                        </Field>
                    )}

                    <Field>
                        <FieldLabel htmlFor={`${id}-gallery`}>특정 갤러리 차단 (선택)</FieldLabel>
                        <Input id={`${id}-gallery`} placeholder="갤러리 ID" value={gallery} onChange={(ev) => setGallery(ev.target.value)}/>
                    </Field>

                    <Field orientation="horizontal">
                        <FieldContent>
                            <FieldLabel>차단 모드</FieldLabel>
                            <FieldDescription id={`${id}-mode-desc`}>
                                {mode ? DETECT_MODE_DESCRIPTIONS[mode] : `기본 차단 모드(${DETECT_MODE_NAMES[defaultMode]}): ${DETECT_MODE_DESCRIPTIONS[defaultMode]}`}
                            </FieldDescription>
                        </FieldContent>
                        <RefresherSelect value={mode} aria-label="차단 모드" aria-describedby={`${id}-mode-desc`} onChange={setMode}
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
