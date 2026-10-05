import {useId, useState} from "react";

import {DialogActions, ModalDialog, SubmitForm} from "@/components/dialogs";
import {Button} from "@/components/ui/button";
import {Checkbox} from "@/components/ui/checkbox";
import {DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Field, FieldError, FieldGroup, FieldLabel} from "@/components/ui/field";
import {Input} from "@/components/ui/input";
import {DETECT_MODE_NAMES, TYPE_NAMES} from "@/core/storage/items";
import type {BlockEntry, BlockType, DetectMode} from "@/core/storage/types";
import type {BlockInputFields} from "@/stores/blocks";
import {messageOf, SAVE_FAILED} from "@/utils/error";

import {RefresherSelect} from "./RefresherSelect";

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
    const [isRegex, setIsRegex] = useState(initial?.isRegex ?? false);
    const [gallery, setGallery] = useState(initial?.gallery ?? "");
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

        try {
            await onSubmit({
                content: content.trim(),
                isRegex,
                mode: mode || undefined,
                gallery: gallery.trim() || undefined,
                // extra는 별명(우클릭 차단 닉네임, 디시콘 제목)이라 입력칸 없이 그대로 유지한다.
                extra: initial?.extra
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

            <SubmitForm onSubmit={submit} className="flex flex-col gap-4">
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
                        <FieldLabel htmlFor={`${id}-gallery`}>특정 갤러리 차단 (선택)</FieldLabel>
                        <Input id={`${id}-gallery`} placeholder="갤러리 ID" value={gallery} onChange={(ev) => setGallery(ev.target.value)}/>
                    </Field>

                    <Field orientation="horizontal" className="justify-between">
                        <FieldLabel>차단 모드</FieldLabel>
                        <RefresherSelect value={mode} aria-label="차단 모드" onChange={setMode} options={{"": "기본값", ...DETECT_MODE_NAMES}}/>
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
