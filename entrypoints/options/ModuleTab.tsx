import {Box, Flex, Switch, Text} from "@radix-ui/themes";

import {useModulesStore} from "@/stores/modules";

import {Empty, Section} from "./Layout";

/** 모듈 on/off만 표시. 세부 설정은 일반 탭에 있다 */
export function ModuleTab() {
    const schemas = useModulesStore((state) => state.schemas);
    const unavailable = useModulesStore((state) => state.unavailable);
    const tabId = useModulesStore((state) => state.tabId);
    const toggle = useModulesStore((state) => state.toggle);

    if (unavailable) return <Empty>디시인사이드 탭을 열어주세요.</Empty>;

    if (schemas.length === 0) return <Empty>모듈이 없습니다.</Empty>;

    return (
        <Section title="모듈">
            {schemas.map((schema, index) => (
                <Box key={schema.id} mb="4" mt={index > 0 ? "4" : undefined}>
                    <Flex justify="between" align="center" gap="3">
                        <Box style={{flex: 1, minWidth: 0}}>
                            <Text size="2" weight="bold">
                                {schema.name}
                            </Text>
                            <Text as="div" size="2" color="gray">
                                {schema.description}
                            </Text>
                        </Box>
                        <Switch size="2" checked={schema.enable}
                                onCheckedChange={(value) => void toggle(schema.id, value, tabId)}/>
                    </Flex>
                </Box>
            ))}
        </Section>
    );
}
