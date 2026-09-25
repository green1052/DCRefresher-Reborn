import {Box, Card, Flex, Heading, Separator, Switch, Text} from "@radix-ui/themes";
import {Fragment} from "react";

import {SettingItem} from "@/components/SettingItem";
import {useModulesStore} from "@/stores/modules";

import {Empty} from "./Layout";

/** 모듈별 카드 — 헤더의 스위치로 on/off, 본문에 세부 설정 */
export function GeneralTab() {
    const schemas = useModulesStore((state) => state.schemas);
    const unavailable = useModulesStore((state) => state.unavailable);
    const tabId = useModulesStore((state) => state.tabId);
    const toggle = useModulesStore((state) => state.toggle);
    const changeSetting = useModulesStore((state) => state.changeSetting);

    if (unavailable) return <Empty>우선 디시인사이드 페이지를 열고 설정해주세요.</Empty>;

    return (
        <Flex direction="column" gap="4">
            {schemas.map((schema) => {
                const settings = Object.entries(schema.settings ?? {});

                return (
                    <Card key={schema.id} size="3">
                        <Flex justify="between" align="center" gap="4">
                            <Box minWidth="0">
                                <Heading as="h2" size="4">{schema.name}</Heading>
                                <Text as="p" size="2" color="gray">{schema.description}</Text>
                            </Box>
                            <Switch
                                size="3"
                                checked={schema.enable}
                                aria-label={`${schema.name} 사용`}
                                onCheckedChange={(value) => void toggle(schema.id, value, tabId)}
                            />
                        </Flex>

                        {schema.enable && settings.length > 0 && (
                            <Box mt="4">
                                {settings.map(([key, settingSchema]) => (
                                    <Fragment key={key}>
                                        <Separator size="4"/>
                                        <SettingItem
                                            schema={settingSchema}
                                            value={schema.values?.[key] ?? settingSchema.default}
                                            onChange={(value) => void changeSetting(schema.id, key, value, tabId)}
                                        />
                                    </Fragment>
                                ))}
                            </Box>
                        )}
                    </Card>
                );
            })}
        </Flex>
    );
}
