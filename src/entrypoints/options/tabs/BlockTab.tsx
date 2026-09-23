import {Button, Card, Flex, Heading, IconButton, Select, Text} from "@radix-ui/themes";
import {Plus, X} from "lucide-react";

import {useAppContext} from "../../popup/context";
import Bubble from "../components/Bubble";

export default function BlockTab() {
    const {blocks} = useAppContext();
    const {
        blocks: blockLists,
        blockModes,
        setBlockMode,
        blockKeyNames,
        blockDetectModeTypeNames,
        blockTypes,
        openBlockDialog,
        removeBlockedUser,
        removeAllBlockedUser,
        editBlockedUser,
        exportBlock,
        importBlock
    } = blocks;

    return (
        <Flex direction="column" gap="4" pt="4">
            <Card size="2">
                <Flex align="center" gap="3" mb="3">
                    <Heading size="3">데이터 관리</Heading>
                    <Button onClick={() => void exportBlock()} size="1" variant="soft">내보내기</Button>
                    <Button onClick={() => void importBlock()} size="1" variant="soft">가져오기</Button>
                </Flex>

                <Heading size="3" mb="2">차단 모드</Heading>
                <Flex direction="column" gap="2">
                    {blockTypes.map((key) => (
                        <Flex align="center" gap="3" key={key}>
                            <Text size="2" style={{width: 120}}>{blockKeyNames[key]}</Text>
                            <Select.Root
                                onValueChange={(value) => setBlockMode(key, value as RefresherBlockDetectMode)}
                                size="2"
                                value={blockModes[key] ?? "SAME"}
                            >
                                <Select.Trigger/>
                                <Select.Content>
                                    {Object.entries(blockDetectModeTypeNames).map(([modeKey, label]) => (
                                        <Select.Item key={modeKey} value={modeKey}>
                                            {label}
                                        </Select.Item>
                                    ))}
                                </Select.Content>
                            </Select.Root>
                        </Flex>
                    ))}
                </Flex>
            </Card>

            {blockTypes.map((key) => (
                <Card key={key} size="2">
                    <Flex align="center" gap="2" mb="3">
                        <Heading size="3">
                            {blockKeyNames[key]} ({blockLists[key].length}개)
                        </Heading>
                        <IconButton onClick={() => openBlockDialog(key)} size="1" variant="soft">
                            <Plus size={16}/>
                        </IconButton>
                        <IconButton color="red" onClick={() => void removeAllBlockedUser(key)} size="1" variant="soft">
                            <X size={14}/>
                        </IconButton>
                    </Flex>

                    <Flex gap="2" wrap="wrap">
                        {blockLists[key].length === 0 && (
                            <Text color="gray" size="1">차단된 {blockKeyNames[key]} 없음</Text>
                        )}
                        {blockLists[key].map((blocked, i) => (
                            <Bubble
                                extra={blocked.extra}
                                gallery={blocked.gallery}
                                image={
                                    key === "DCCON"
                                        ? `https://image.dcinside.com/dccon.php?no=${blocked.isRegex ? (blocked.content.match(/^\^\((\w*)\|/)?.at(1) ?? blocked.content) : blocked.content}`
                                        : undefined
                                }
                                key={`${blocked.content}:${i}`}
                                remove={() => void removeBlockedUser(key, blocked.content)}
                                text={blocked.content}
                                textclick={() => void editBlockedUser(key, blocked.content)}
                            />
                        ))}
                    </Flex>
                </Card>
            ))}
        </Flex>
    );
}
