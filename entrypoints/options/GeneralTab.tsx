import {Fragment} from "react";

import {Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Collapsible, CollapsibleContent} from "@/components/ui/collapsible";
import {Separator} from "@/components/ui/separator";
import {Switch} from "@/components/ui/switch";
import {defaultValue} from "@/core/module/settings";
import type {AnyModuleMeta, SettingSchema} from "@/core/module/types";
import features from "@/features/meta";
import {useModulesStore} from "@/stores/modules";
import {SAVE_FAILED} from "@/utils/error";

import {notify} from "./optionsStore";
import {SettingItem} from "./SettingItem";

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
        <div className="pt-4">
            {[...Map.groupBy(settings, ([key, schema]) => schema.group ?? key).values()].map((entries) => {
                const [first] = entries;
                const group = first![1].group;
                return (
                    <Fragment key={first![0]}>
                        <Separator/>
                        {group ? (
                            <div className="py-3" role="group" aria-label={group.name}>
                                <p className="font-medium">{group.name}</p>
                                <p className="mb-2 text-xs text-muted-foreground">{group.desc}</p>
                                {/* 글 입력칸·슬라이더는 칸 하나에 넣기엔 좁다. 섞여 있으면 묶음 전체를 한 줄에 하나씩 그려 조작부를 오른쪽 끝에 맞춘다. */}
                                <div className={entries.some(([, schema]) => schema.type === "text" || schema.type === "range") ? "grid grid-cols-1 gap-x-6" : "grid grid-cols-2 gap-x-6 sm:grid-cols-3"}>
                                    {entries.map((entry) => item(entry, true))}
                                </div>
                            </div>
                        ) : (
                            item(first!)
                        )}
                    </Fragment>
                );
            })}
        </div>
    );
};

/** 모듈 카드. 헤더의 스위치로 켜고 끄며, 켜져 있을 때 세부 설정을 펼친다. */
const ModuleCard = ({feature}: { feature: AnyModuleMeta }) => {
    const enabled = useModulesStore((state) => state.enables[feature.id] === true);
    const toggle = useModulesStore((state) => state.toggle);
    const settings = Object.entries(feature.settings ?? {});

    return (
        <Card>
            <CardHeader>
                <CardTitle><h2>{feature.name}</h2></CardTitle>
                <CardDescription>{feature.description}</CardDescription>
                <CardAction className="self-center">
                    <Switch
                        checked={enabled}
                        aria-label={`${feature.name} 사용`}
                        onCheckedChange={(value) => void toggle(feature.id, value).catch(() => notify(SAVE_FAILED))}
                    />
                </CardAction>
            </CardHeader>

            {settings.length > 0 && (
                <Collapsible open={enabled}>
                    {/* 켜고 끌 때 펼치고 접는다. 닫히는 애니메이션이 끝난 뒤 빠진다.
                        overflow-clip에 여백을 둔다. 없으면 가장자리 스위치·입력칸의 포커스 테두리가 잘린다. */}
                    <CollapsibleContent
                        className="h-(--collapsible-panel-height) overflow-clip transition-[height,opacity] duration-200 ease-out [overflow-clip-margin:6px] data-ending-style:h-0 data-ending-style:opacity-0 data-starting-style:h-0 data-starting-style:opacity-0 motion-reduce:transition-none">
                        <CardContent className="-mt-4">
                            <ModuleSettings feature={feature} settings={settings}/>
                        </CardContent>
                    </CollapsibleContent>
                </Collapsible>
            )}
        </Card>
    );
};

export function GeneralTab() {
    return (
        <div className="flex flex-col gap-4">
            {features.map((feature) => <ModuleCard key={feature.id} feature={feature}/>)}
        </div>
    );
}
