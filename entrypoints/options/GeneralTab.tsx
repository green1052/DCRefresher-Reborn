import {Box, Card, Flex, Grid, Heading, Separator, Switch, Text} from "@radix-ui/themes";
import {Fragment} from "react";

import {SettingItem} from "@/components/SettingItem";
import type {SettingGroup, SettingSchema} from "@/core/module/types";
import features from "@/features";
import {useModulesStore} from "@/stores/modules";

interface SettingRow {
    group?: SettingGroup;
    entries: [string, SettingSchema][];
}

/** 같은 group 객체를 가진 연속된 설정을 한 줄로 묶는다 */
const groupRows = (settings: [string, SettingSchema][]): SettingRow[] => {
    const rows: SettingRow[] = [];
    for (const entry of settings) {
        const group = entry[1].group;
        const last = rows.at(-1);
        if (group && last?.group === group) last.entries.push(entry);
        else rows.push({group, entries: [entry]});
    }
    return rows;
};

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
                                {groupRows(settings).map((row) => {
                                    const item = ([key, schema]: [string, SettingSchema], compact?: boolean) => (
                                        <SettingItem
                                            key={key}
                                            schema={schema}
                                            compact={compact}
                                            value={values[feature.id]?.[key] ?? schema.default}
                                            onChange={(value) => void changeSetting(feature.id, key, value)}
                                        />
                                    );

                                    return (
                                        <Fragment key={row.entries[0]![0]}>
                                            <Separator size="4"/>
                                            {row.group ? (
                                                <Box py="3">
                                                    <Text as="p" size="2" weight="medium">{row.group.name}</Text>
                                                    <Text as="p" size="1" color="gray" mb="2">{row.group.desc}</Text>
                                                    <Grid columns={{initial: "2", sm: "3"}} gapX="5">
                                                        {row.entries.map((entry) => item(entry, true))}
                                                    </Grid>
                                                </Box>
                                            ) : (
                                                item(row.entries[0]!)
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
