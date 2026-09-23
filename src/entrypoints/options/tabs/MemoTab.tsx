import {Button, Card, Flex, Heading, IconButton, Text} from "@radix-ui/themes";
import {Plus, X} from "lucide-react";

import {useAppContext} from "../../popup/context";
import Bubble from "../components/Bubble";

export default function MemoTab() {
    const {memos} = useAppContext();
    const {
        memos: memoLists,
        memoKeyNames,
        memoTypes,
        removeMemoUser,
        removeAllMemoUser,
        addMemoUser,
        editMemoUser,
        exportMemo,
        importMemo
    } = memos;

    const open = (url: string) => {
        browser.tabs.create({url});
    };

    return (
        <Flex direction="column" gap="4" pt="4">
            <Card size="2">
                <Flex align="center" gap="3">
                    <Heading size="3">데이터 관리</Heading>
                    <Button onClick={() => void exportMemo()} size="1" variant="soft">내보내기</Button>
                    <Button onClick={() => void importMemo()} size="1" variant="soft">가져오기</Button>
                    <Button
                        onClick={() => open("https://dcrefresher.green1052.com/utils/convert-memo")}
                        size="1"
                        variant="soft"
                    >
                        메모 변환
                    </Button>
                </Flex>
            </Card>

            {memoTypes.map((key) => (
                <Card key={key} size="2">
                    <Flex align="center" gap="2" mb="3">
                        <Heading size="3">
                            {memoKeyNames[key]} ({Object.keys(memoLists[key]).length}개)
                        </Heading>
                        <IconButton onClick={() => void addMemoUser(key)} size="1" variant="soft">
                            <Plus size={16}/>
                        </IconButton>
                        <IconButton color="red" onClick={() => void removeAllMemoUser(key)} size="1" variant="soft">
                            <X size={14}/>
                        </IconButton>
                    </Flex>

                    <Flex gap="2" wrap="wrap">
                        {Object.keys(memoLists[key]).length === 0 && (
                            <Text color="gray" size="1">{memoKeyNames[key]} 메모 없음</Text>
                        )}
                        {Object.entries(memoLists[key]).map(([user, memo]) => (
                            <Bubble
                                key={`memo:${user}`}
                                remove={() => void removeMemoUser(key, user)}
                                text={`${user} (${memo.text.substring(0, 10)})`}
                                textclick={() => void editMemoUser(key, user)}
                            />
                        ))}
                    </Flex>
                </Card>
            ))}
        </Flex>
    );
}
