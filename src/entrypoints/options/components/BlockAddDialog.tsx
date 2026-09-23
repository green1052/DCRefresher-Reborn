import {Button, Dialog, Flex, Select, Switch, Text, TextField} from "@radix-ui/themes";
import {useEffect, useState} from "react";

import type {BlockFormData} from "../../popup/hooks/useBlocks";
import {useAppContext} from "../../popup/context";

const EMPTY_FORM: BlockFormData = {
    content: "",
    isRegex: false,
    gallery: "",
    mode: "NONE"
};

// 폼 상태는 다이얼로그 로컬. 전역에 두면 글자 1개에 차단 목록 전체가 리렌더된다.
export default function BlockAddDialog() {
    const {blocks} = useAppContext();
    const {
        showBlockDialog,
        currentBlockType,
        blockKeyNames,
        blockDetectModeTypeNames,
        closeBlockDialog,
        confirmAddBlock
    } = blocks;
    const [formData, setFormData] = useState<BlockFormData>(EMPTY_FORM);

    // 열릴 때마다 폼을 비운다.
    useEffect(() => {
        if (showBlockDialog) setFormData(EMPTY_FORM);
    }, [showBlockDialog]);

    const patch = (p: Partial<BlockFormData>) => setFormData((prev) => ({...prev, ...p}));
    const confirm = () => {
        void confirmAddBlock(formData);
        closeBlockDialog();
    };

    return (
        <Dialog.Root
            onOpenChange={(open) => {
                if (!open) closeBlockDialog();
            }}
            open={showBlockDialog}
        >
            <Dialog.Content maxWidth="480px">
                <Dialog.Title>{blockKeyNames[currentBlockType]} 차단 추가</Dialog.Title>

                <Flex direction="column" gap="4" mt="4">
                    <Flex align="center" gap="3" justify="between">
                        <Text size="2" weight="medium">{blockKeyNames[currentBlockType]}</Text>
                        <TextField.Root
                            onChange={(ev) => patch({content: ev.target.value})}
                            onKeyDown={(ev) => {
                                if (ev.key === "Enter") confirm();
                            }}
                            placeholder={`${blockKeyNames[currentBlockType]} 값을 입력하세요`}
                            size="2"
                            style={{width: 260}}
                            value={formData.content}
                        />
                    </Flex>

                    <Flex align="center" gap="3" justify="between">
                        <Text size="2" weight="medium">정규식 사용</Text>
                        <Switch
                            checked={formData.isRegex}
                            onCheckedChange={(value) => patch({isRegex: value})}
                        />
                    </Flex>

                    <Flex align="center" gap="3" justify="between">
                        <Text size="2" weight="medium">특정 갤러리 차단 (선택)</Text>
                        <TextField.Root
                            onChange={(ev) => patch({gallery: ev.target.value})}
                            placeholder="갤러리 ID"
                            size="2"
                            style={{width: 260}}
                            value={formData.gallery}
                        />
                    </Flex>

                    <Flex align="center" gap="3" justify="between">
                        <Text size="2" weight="medium">차단 모드</Text>
                        <Select.Root
                            onValueChange={(value) => patch({mode: value as RefresherBlockDetectMode | "NONE"})}
                            size="2"
                            value={formData.mode}
                        >
                            <Select.Trigger style={{width: 260}}/>
                            <Select.Content>
                                <Select.Item value="NONE">기본값</Select.Item>
                                {Object.entries(blockDetectModeTypeNames).map(([key, label]) => (
                                    <Select.Item key={key} value={key}>
                                        {label}
                                    </Select.Item>
                                ))}
                            </Select.Content>
                        </Select.Root>
                    </Flex>

                    <Flex gap="3" justify="end" mt="2">
                        <Dialog.Close>
                            <Button color="gray" variant="soft">취소</Button>
                        </Dialog.Close>
                        <Button onClick={confirm}>추가</Button>
                    </Flex>
                </Flex>
            </Dialog.Content>
        </Dialog.Root>
    );
}
