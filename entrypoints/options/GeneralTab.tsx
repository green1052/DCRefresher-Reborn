import {Box, Card, Flex, Heading, Separator, Switch, Text} from "@radix-ui/themes";
import {Fragment} from "react";

import {SettingItem} from "@/components/SettingItem";
import features from "@/features";
import {useModulesStore} from "@/stores/modules";

/** 모듈별 카드 — 헤더의 스위치로 on/off, 본문에 세부 설정 */
export function GeneralTab() {
    const enables = useModulesStore((state) => state.enables);
    const values = useModulesStore((state) => state.values);
    const toggle = useModulesStore((state) => state.toggle);
    const changeSetting = useModulesStore((state) => state.changeSetting);

    return (
        <Flex direction="column" gap="4">
            {features.map((feature) => {
                const enabled = enables[feature.id] ?? true;
                const settings = Object.entries(feature.settings ?? {});

                return (
                    <Card key={feature.id} size="3">
                        <Flex justify="between" align="center" gap="4">
                            <Box minWidth="0">
                                <Heading as="h2" size="4">{feature.name}</Heading>
                                <Text as="p" size="2" color="gray">{feature.description}</Text>
                            </Box>
                            <Switch
                                size="3"
                                checked={enabled}
                                aria-label={`${feature.name} 사용`}
                                onCheckedChange={(value) => void toggle(feature.id, value)}
                            />
                        </Flex>

                        {enabled && settings.length > 0 && (
                            <Box mt="4">
                                {settings.map(([key, schema]) => (
                                    <Fragment key={key}>
                                        <Separator size="4"/>
                                        <SettingItem
                                            schema={schema}
                                            value={values[feature.id]?.[key] ?? schema.default}
                                            onChange={(value) => void changeSetting(feature.id, key, value)}
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
