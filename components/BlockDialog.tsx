import {Button, Checkbox, Dialog, Flex, Text, TextField} from "@radix-ui/themes";
import {useEffect, useState} from "react";

import {RefresherSelect} from "@/components/RefresherSelect";
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
            <Dialog.Content maxWidth="480px">
                <Dialog.Title>
                    {typeNames[type]} 차단 {initial ? "수정" : "추가"}
                </Dialog.Title>
                <Dialog.Description size="2" mb="4">
                    {initial ? `${typeNames[type]} 항목을 수정합니다.` : `${typeNames[type]} 차단 항목을 추가합니다.`}
                </Dialog.Description>

                <Flex direction="column" gap="3">
                    <label>
                        <Flex justify="between" mb="1">
                            <Text size="2" color="gray">
                                값
                            </Text>
                        </Flex>
                        <TextField.Root
                            placeholder={`${typeNames[type]} 값을 입력하세요`}
                            value={content}
                            onChange={(event) => setContent(event.target.value)}
                            onKeyDown={(event) => event.key === "Enter" && submit()}
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
                                        onChange={(event) => setGallery(event.target.value)}/>
                    </label>

                    <Flex justify="between" align="center">
                        <Text size="2" color="gray">
                            차단 모드
                        </Text>
                        <RefresherSelect
                            value={mode}
                            onChange={(next) => setMode(next as DetectMode | "")}
                            options={[["", "기본값"], ...Object.entries(modeNames)]}
                        />
                    </Flex>

                    {error && (
                        <Text size="2" color="red">
                            {error}
                        </Text>
                    )}
                </Flex>

                <Flex gap="3" justify="end" mt="4">
                    <Dialog.Close>
                        <Button variant="soft" color="gray">
                            취소
                        </Button>
                    </Dialog.Close>
                    <Button onClick={submit}>{initial ? "수정" : "추가"}</Button>
                </Flex>
            </Dialog.Content>
        </Dialog.Root>
    );
};
