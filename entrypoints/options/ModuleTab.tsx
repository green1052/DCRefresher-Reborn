import {Badge, Box, Flex, Heading, Switch, Text} from "@radix-ui/themes";

import {SettingItem} from "@/components/SettingItem";
import {useModulesStore} from "@/stores/modules";

import {Empty, Section} from "./Layout";

export function ModuleTab() {
    const schemas = useModulesStore((state) => state.schemas);
    const unavailable = useModulesStore((state) => state.unavailable);
    const tabId = useModulesStore((state) => state.tabId);
    const toggle = useModulesStore((state) => state.toggle);
    const changeSetting = useModulesStore((state) => state.changeSetting);

    if (unavailable) return <Empty>디시인사이드 탭을 열어주세요.</Empty>;

    if (schemas.length === 0) return <Empty>모듈이 없습니다.</Empty>;

    return (
        <Box>
            {schemas.map((schema) => (
                <Section
                    key={schema.id}
                    title={schema.name}
                    actions={
                        <>
                            <Text size="1" color="gray" mr="2">
                                {schema.running ? "활성" : "비활성"}
                            </Text>
                            <Switch size="1" checked={schema.enable} onCheckedChange={(value) => void toggle(schema.id, value, tabId)} />
                        </>
                    }
                >
                    <Text as="div" size="2" color="gray" mb="3">
                        {schema.description}
                    </Text>

                    {schema.settings &&
                        Object.entries(schema.settings).map(([key, settingSchema]) => (
                            <SettingItem
                                key={key}
                                schema={settingSchema}
                                value={schema.values?.[key] ?? settingSchema.default}
                                disabled={!schema.enable}
                                onChange={(value) => void changeSetting(schema.id, key, value, tabId)}
                            />
                        ))}
                </Section>
            ))}
        </Box>
    );
}
