import {Button, Checkbox, Dialog, Flex, Text, TextField} from "@radix-ui/themes";
import {useState} from "react";

import {DialogActions} from "@/components/ConfirmDialog";
import {RefresherSelect} from "@/components/RefresherSelect";
import {useOpenerFocus} from "@/components/useOpenerFocus";
import {DETECT_MODE_NAMES, TYPE_NAMES} from "@/core/storage/items";
import type {BlockEntry, BlockType, DetectMode} from "@/core/storage/types";
import type {BlockInputFields} from "@/stores/blocks";
import {messageOf, SAVE_FAILED} from "@/utils/error";

interface BlockDialogProps {
    type: BlockType;
    /** 수정할 기존 항목. 없으면 추가 */
    initial?: BlockEntry | null;
    onClose: () => void;
    onSubmit: (fields: BlockInputFields) => Promise<void>;
}

/** 차단 항목 추가/수정 다이얼로그. 입력 초기값을 마운트 시점의 initial에서 잡으므로 열 때만 마운트한다 */
export const BlockDialog = ({type, initial, onClose, onSubmit}: BlockDialogProps) => {
    const [content, setContent] = useState(initial?.content ?? "");
    const [isRegex, setIsRegex] = useState(initial?.isRegex ?? false);
    const [gallery, setGallery] = useState(initial?.gallery ?? "");
    const [mode, setMode] = useState<DetectMode | "">(initial?.mode ?? "");
    const [error, setError] = useState("");
    const {onCloseAutoFocus} = useOpenerFocus();

    const submit = async (): Promise<void> => {
        if (!content.trim()) {
            setError(`${TYPE_NAMES[type]} 값을 입력해 주세요.`);
            return;
        }
        // 틀린 정규식은 차단 검사에서 조용히 건너뛰어 아무것도 걸리지 않으므로 저장 전에 알린다
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
                // extra는 별명(우클릭 차단 닉네임, 디시콘 제목)이라 입력칸 없이 그대로 유지한다
                extra: initial?.extra
            });
        } catch {
            setError(SAVE_FAILED);
        }
    };

    return (
        <Dialog.Root open onOpenChange={(next) => !next && onClose()}>
            <Dialog.Content maxWidth="480px" onCloseAutoFocus={onCloseAutoFocus}>
                <Dialog.Title>
                    {TYPE_NAMES[type]} 차단 {initial ? "수정" : "추가"}
                </Dialog.Title>
                <Dialog.Description size="2" mb="4">
                    {initial ? `${TYPE_NAMES[type]} 항목을 수정합니다.` : `${TYPE_NAMES[type]} 차단 항목을 추가합니다.`}
                </Dialog.Description>

                {/* Enter로 저장한다. 폼 제출이라 한글 조합을 끝내는 Enter로는 브라우저가 제출하지 않는다 */}
                <form onSubmit={(ev) => {
                    ev.preventDefault();
                    void submit();
                }}>
                    <Flex direction="column" gap="3">
                        <label>
                            <Flex justify="between" mb="1">
                                <Text size="2" color="gray">
                                    값
                                </Text>
                            </Flex>
                            <TextField.Root
                                placeholder={`${TYPE_NAMES[type]} 값을 입력해 주세요`}
                                value={content}
                                onChange={(ev) => setContent(ev.target.value)}
                                autoFocus
                            />
                        </label>

                        <Text as="label" size="2">
                            <Flex gap="2" align="center">
                                <Checkbox checked={isRegex} onCheckedChange={(value) => setIsRegex(value === true)}/> 정규식
                            </Flex>
                        </Text>

                        <label>
                            <Text as="div" size="2" color="gray" mb="1">
                                특정 갤러리 차단 (선택)
                            </Text>
                            <TextField.Root placeholder="갤러리 ID" value={gallery}
                                            onChange={(ev) => setGallery(ev.target.value)}/>
                        </label>

                        <Flex justify="between" align="center">
                            <Text size="2" color="gray">
                                차단 모드
                            </Text>
                            <RefresherSelect
                                value={mode}
                                aria-label="차단 모드"
                                onChange={setMode}
                                options={{"": "기본값", ...DETECT_MODE_NAMES}}
                            />
                        </Flex>

                        {error && (
                            <Text size="2" color="red" role="alert">
                                {error}
                            </Text>
                        )}
                    </Flex>

                    <DialogActions>
                        <Button type="submit">{initial ? "수정" : "추가"}</Button>
                    </DialogActions>
                </form>
            </Dialog.Content>
        </Dialog.Root>
    );
};
