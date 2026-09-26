import {Button, Checkbox, Dialog, Flex, Text, TextField} from "@radix-ui/themes";
import {useState} from "react";

import {DialogActions} from "@/components/ConfirmDialog";
import {RefresherSelect} from "@/components/RefresherSelect";
import {DETECT_MODE_NAMES, TYPE_NAMES} from "@/core/storage/items";
import type {BlockEntry, BlockType, DetectMode} from "@/core/storage/types";
import type {BlockInputFields} from "@/stores/blocks";

interface BlockDialogProps {
    type: BlockType;
    /** 편집시 기존 항목 */
    initial?: BlockEntry | null;
    onClose: () => void;
    onSubmit: (fields: BlockInputFields) => Promise<void>;
}

/** 열 때만 마운트한다 — 입력 초기값은 마운트 시점의 initial */
export const BlockDialog = ({type, initial, onClose, onSubmit}: BlockDialogProps) => {
    const [content, setContent] = useState(initial?.content ?? "");
    const [isRegex, setIsRegex] = useState(initial?.isRegex ?? false);
    const [gallery, setGallery] = useState(initial?.gallery ?? "");
    const [mode, setMode] = useState<DetectMode | "">(initial?.mode ?? "");
    const [error, setError] = useState("");

    const submit = async (): Promise<void> => {
        if (!content.trim()) {
            setError(`${TYPE_NAMES[type]} 값을 입력해주세요.`);
            return;
        }
        // 틀린 정규식은 차단할 때 조용히 건너뛰어 저장돼도 아무것도 안 걸린다 — 저장 전에 알린다
        if (isRegex) {
            try {
                new RegExp(content.trim());
            } catch (e) {
                setError(`정규식이 올바르지 않습니다. ${e instanceof Error ? e.message : String(e)}`);
                return;
            }
        }

        try {
            await onSubmit({
                content: content.trim(),
                isRegex,
                mode: mode || undefined,
                gallery: gallery.trim() || undefined,
                // extra는 별명(우클릭 차단 닉네임, 디시콘 제목)만 유지한다 — 예전 플래그 문자열은 스토어가 읽을 때 버렸다
                extra: initial?.extra
            });
        } catch (e) {
            setError(`저장하지 못했습니다. ${e instanceof Error ? e.message : String(e)}`);
        }
    };

    return (
        <Dialog.Root open onOpenChange={(next) => !next && onClose()}>
            <Dialog.Content maxWidth="480px">
                <Dialog.Title>
                    {TYPE_NAMES[type]} 차단 {initial ? "수정" : "추가"}
                </Dialog.Title>
                <Dialog.Description size="2" mb="4">
                    {initial ? `${TYPE_NAMES[type]} 항목을 수정합니다.` : `${TYPE_NAMES[type]} 차단 항목을 추가합니다.`}
                </Dialog.Description>

                <Flex direction="column" gap="3">
                    <label>
                        <Flex justify="between" mb="1">
                            <Text size="2" color="gray">
                                값
                            </Text>
                        </Flex>
                        <TextField.Root
                            placeholder={`${TYPE_NAMES[type]} 값을 입력하세요`}
                            value={content}
                            onChange={(ev) => setContent(ev.target.value)}
                            onKeyDown={(ev) => ev.key === "Enter" && !ev.nativeEvent.isComposing && void submit()}
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
                            onChange={(next) => setMode(next as DetectMode | "")}
                            options={[["", "기본값"], ...Object.entries(DETECT_MODE_NAMES)]}
                        />
                    </Flex>

                    {error && (
                        <Text size="2" color="red">
                            {error}
                        </Text>
                    )}
                </Flex>

                <DialogActions>
                    <Button onClick={() => void submit()}>{initial ? "수정" : "추가"}</Button>
                </DialogActions>
            </Dialog.Content>
        </Dialog.Root>
    );
};
