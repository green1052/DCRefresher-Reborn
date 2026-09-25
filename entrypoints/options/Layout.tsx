import {Box, Button, Card, Dialog, Flex, Heading, Text, TextArea} from "@radix-ui/themes";
import {type ReactNode, useState} from "react";

/** 옵션 페이지 전용 레이아웃 — 스타일은 Radix Themes 프롭만 사용 */
export const Section = ({title, desc, actions, children}: {
    title?: ReactNode;
    desc?: ReactNode;
    actions?: ReactNode;
    children?: ReactNode
}) => (
    <Card size="3" mb="4">
        {(title || desc || actions) && (
            <Flex justify="between" align="center" gap="4" wrap="wrap" mb={children ? "4" : "0"}>
                <Box minWidth="0">
                    {title && <Heading as="h2" size="4">{title}</Heading>}
                    {desc && <Text as="p" size="2" color="gray">{desc}</Text>}
                </Box>
                {actions && (
                    <Flex gap="2" align="center" ml="auto">
                        {actions}
                    </Flex>
                )}
            </Flex>
        )}
        {children}
    </Card>
);

export const Empty = ({children}: { children: ReactNode }) => (
    <Box py="6">
        <Text as="p" size="2" color="gray" align="center">
            {children}
        </Text>
    </Box>
);

/**
 * 내보낸 JSON을 붙여넣는 가져오기 다이얼로그 (차단/메모/데이터 공용).
 * 열 때만 마운트한다 — 닫으면 입력이 초기화되고, 실패해 열려 있으면 붙여넣은 텍스트가 남는다
 */
export const ImportDialog = ({title, onClose, onSubmit}: {
    title: string;
    onClose: () => void;
    onSubmit: (text: string) => Promise<void>;
}) => {
    const [text, setText] = useState("");
    const [busy, setBusy] = useState(false);

    const submit = async (): Promise<void> => {
        setBusy(true);
        try {
            await onSubmit(text);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog.Root open onOpenChange={(next) => !next && onClose()}>
            <Dialog.Content maxWidth="520px">
                <Dialog.Title>{title}</Dialog.Title>
                <Dialog.Description size="2" mb="3">
                    내보낸 JSON 데이터를 붙여넣어주세요.
                </Dialog.Description>

                <TextArea placeholder="JSON 데이터" value={text} rows={8} autoFocus
                          onChange={(event) => setText(event.target.value)}/>

                <Flex gap="3" justify="end" mt="4">
                    <Dialog.Close>
                        <Button variant="soft" color="gray">취소</Button>
                    </Dialog.Close>
                    <Button loading={busy} disabled={!text.trim()} onClick={() => void submit()}>가져오기</Button>
                </Flex>
            </Dialog.Content>
        </Dialog.Root>
    );
};
