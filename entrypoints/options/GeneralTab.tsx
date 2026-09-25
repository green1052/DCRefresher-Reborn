import {Box, Card, Flex, Grid, Heading, Separator, Switch, Text} from "@radix-ui/themes";
import {Fragment} from "react";

import {SettingItem} from "@/components/SettingItem";
import type {SettingSchema} from "@/core/module/types";
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
                                {/* 같은 group 객체를 가진 설정은 첫 설정 자리에 한 줄로 묶는다 */}
                                {[...Map.groupBy(settings, ([key, schema]) => schema.group ?? key).values()].map((entries) => {
                                    const group = entries[0]![1].group;
                                    const valueOf = (key: string, schema: SettingSchema) => values[feature.id]?.[key] ?? schema.default;
                                    const item = ([key, schema]: [string, SettingSchema], compact?: boolean) => (
                                        <SettingItem
                                            key={key}
                                            schema={schema}
                                            compact={compact}
                                            takenKeys={schema.type === "key"
                                                ? settings.filter(([other, s]) => other !== key && s.type === "key").map(([other, s]) => String(valueOf(other, s)))
                                                : undefined}
                                            value={valueOf(key, schema)}
                                            onChange={(value) => void changeSetting(feature.id, key, value)}
                                        />
                                    );

                                    return (
                                        <Fragment key={entries[0]![0]}>
                                            <Separator size="4"/>
                                            {group ? (
                                                <Box py="3">
                                                    <Text as="p" size="2" weight="medium">{group.name}</Text>
                                                    <Text as="p" size="1" color="gray" mb="2">{group.desc}</Text>
                                                    {/* 글 입력칸·슬라이더는 칸 하나로는 좁다 — 섞여 있으면 묶음 전체를 한 줄씩 그려 조작 위치를 오른쪽 끝으로 맞춘다 */}
                                                    <Grid columns={entries.some(([, s]) => s.type === "text" || s.type === "range") ? "1" : {initial: "2", sm: "3"}} gapX="5">
                                                        {entries.map((entry) => item(entry, true))}
                                                    </Grid>
                                                </Box>
                                            ) : (
                                                item(entries[0]!)
                                            )}
                                        </Fragment>
                                    );
                                })}
                            </Box>
                        )}
                    </Card>
                );
            })}
        </Flex>
    );
}
