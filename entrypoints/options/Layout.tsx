import {Box, Card, Flex, Heading, Text} from "@radix-ui/themes";
import type {ReactNode} from "react";

/** 옵션 페이지 전용 레이아웃 — 스타일은 Radix Themes 프롭만 사용 */
export const Section = ({title, desc, actions, children}: {title?: ReactNode; desc?: ReactNode; actions?: ReactNode; children?: ReactNode}) => (
    <Card variant="surface" size="3" style={{boxShadow: "none"}} mb="4">
        {(title || actions) && (
            <Flex justify="between" align="center" mb="2">
                {title && <Heading size="4">{title}</Heading>}
                {actions && (
                    <Flex gap="2" align="center">
                        {actions}
                    </Flex>
                )}
            </Flex>
        )}
        {desc && (
            <Text as="p" size="2" color="gray" mb="3">
                {desc}
            </Text>
        )}
        {children}
    </Card>
);

export const Row = ({left, right}: {left: ReactNode; right?: ReactNode}) => (
    <Flex justify="between" align="center" gap="3" py="2">
        <Box style={{flex: 1, minWidth: 0}}>{left}</Box>
        {right}
    </Flex>
);

export const Empty = ({children}: {children: ReactNode}) => (
    <Box py="6" style={{textAlign: "center"}}>
        <Text size="2" color="gray">
            {children}
        </Text>
    </Box>
);
