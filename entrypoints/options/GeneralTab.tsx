import {Box, Card, Flex, Grid, Heading, Separator, Switch, Text} from "@radix-ui/themes";
import {Collapsible} from "radix-ui";
import {Fragment} from "react";

import {SettingItem} from "@/components/SettingItem";
import {defaultValue, isModuleEnabled} from "@/core/module/settings";
import type {AnyModuleMeta, SettingSchema} from "@/core/module/types";
import features from "@/features/meta";
import {useModulesStore} from "@/stores/modules";
import {SAVE_FAILED} from "@/utils/error";

import {notify} from "./optionsStore";

type SettingEntry = [key: string, schema: SettingSchema];

/** 모듈 하나의 세부 설정. 같은 group 객체를 가진 설정은 첫 설정 자리에 한 칸으로 묶는다. */
const ModuleSettings = ({feature, settings}: { feature: AnyModuleMeta; settings: SettingEntry[] }) => {
    // 이 모듈의 값만 구독한다. 다른 모듈의 설정을 바꿔도 이 카드는 다시 그리지 않는다.
    const values = useModulesStore((state) => state.values[feature.id]);
    const changeSetting = useModulesStore((state) => state.changeSetting);
    const valueOf = (key: string, schema: SettingSchema) => values?.[key] ?? defaultValue(schema);

    // 같은 모듈의 다른 단축키 설정이 쓰는 키. 고를 수 없게 한다.
    const takenKeys = (key: string): string[] =>
        settings.filter(([other, schema]) => other !== key && schema.type === "key").map(([other, schema]) => String(valueOf(other, schema)));

    const item = ([key, schema]: SettingEntry, compact?: boolean) => (
        <SettingItem
            key={key}
            schema={schema}
            compact={compact}
            takenKeys={schema.type === "key" ? takenKeys(key) : undefined}
            value={valueOf(key, schema)}
            onChange={(value) => void changeSetting(feature.id, key, value).catch(() => notify(SAVE_FAILED))}
        />
    );

    return (
        <Box pt="4">
            {[...Map.groupBy(settings, ([key, schema]) => schema.group ?? key).values()].map((entries) => {
                const [first] = entries;
                const group = first![1].group;
                return (
                    <Fragment key={first![0]}>
                        <Separator size="4"/>
                        {group ? (
                            <Box py="3" role="group" aria-label={group.name}>
                                <Text as="p" size="2" weight="medium">{group.name}</Text>
                                <Text as="p" size="1" color="gray" mb="2">{group.desc}</Text>
                                {/* 글 입력칸·슬라이더는 칸 하나에 넣기엔 좁다. 섞여 있으면 묶음 전체를 한 줄에 하나씩 그려 조작부를 오른쪽 끝에 맞춘다. */}
                                <Grid columns={entries.some(([, schema]) => schema.type === "text" || schema.type === "range") ? "1" : {initial: "2", sm: "3"}} gapX="5">
                                    {entries.map((entry) => item(entry, true))}
                                </Grid>
                            </Box>
                        ) : (
                            item(first!)
                        )}
                    </Fragment>
                );
            })}
        </Box>
    );
};

/** 모듈 카드. 헤더의 스위치로 켜고 끄며, 켜져 있을 때 세부 설정을 펼친다. */
const ModuleCard = ({feature}: { feature: AnyModuleMeta }) => {
    const enabled = useModulesStore((state) => isModuleEnabled(feature, state.enables));
    const toggle = useModulesStore((state) => state.toggle);
    const settings = Object.entries(feature.settings ?? {});

    return (
        <Card size="3">
            <Flex justify="between" align="center" gap="4">
                <Box minWidth="0">
                    <Heading as="h2" size="4">{feature.name}</Heading>
                    <Text as="p" size="2" color="gray">{feature.description}</Text>
                </Box>
                <Switch
                    size="3"
                    checked={enabled}
                    aria-label={`${feature.name} 사용`}
                    onCheckedChange={(value) => void toggle(feature.id, value).catch(() => notify(SAVE_FAILED))}
                />
            </Flex>

            {settings.length > 0 && (
                <Collapsible.Root open={enabled}>
                    {/* 켜고 끌 때 펼치고 접는다 (options.scss). 닫히는 애니메이션이 끝난 뒤 빠진다. */}
                    <Collapsible.Content className="refresher-collapsible">
                        <ModuleSettings feature={feature} settings={settings}/>
                    </Collapsible.Content>
                </Collapsible.Root>
            )}
        </Card>
    );
};

/** 모듈별 카드 목록. */
export function GeneralTab() {
    return (
        <Flex direction="column" gap="4">
            {features.map((feature) => <ModuleCard key={feature.id} feature={feature}/>)}
        </Flex>
    );
}
