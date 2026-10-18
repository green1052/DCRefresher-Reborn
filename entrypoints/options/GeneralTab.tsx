import {Search} from "lucide-react";
import {Fragment, type RefObject, useEffect, useRef, useState} from "react";

import {Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Collapsible, CollapsibleContent} from "@/components/ui/collapsible";
import {Empty, EmptyDescription} from "@/components/ui/empty";
import {InputGroup, InputGroupAddon, InputGroupInput} from "@/components/ui/input-group";
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

/**
 * 검색어(소문자)에 맞는 설정. 모듈 이름·설명이 맞으면 전부, 아니면 이름·설명·묶음 이름이 맞는 설정만 남긴다.
 * 맞는 것이 없으면 undefined. 검색어가 비면 전부다.
 */
export const matchSettings = (feature: AnyModuleMeta, needle: string): SettingEntry[] | undefined => {
    const settings = Object.entries(feature.settings ?? {});
    const has = (...texts: string[]) => texts.some((text) => text.toLowerCase().includes(needle));
    if (has(feature.name, feature.description)) return settings;
    const matched = settings.filter(([, schema]) => has(schema.name, schema.desc, schema.group?.name ?? ""));
    return matched.length > 0 ? matched : undefined;
};

/** 모듈 하나의 세부 설정. 같은 group 객체를 가진 설정은 첫 설정 자리에 한 칸으로 묶는다. shown은 그릴 설정(검색에 맞는 것)이다. */
const ModuleSettings = ({feature, settings, shown}: { feature: AnyModuleMeta; settings: SettingEntry[]; shown: SettingEntry[] }) => {
    // 이 모듈의 값만 구독한다. 다른 모듈의 설정을 바꿔도 이 카드는 다시 그리지 않는다.
    const values = useModulesStore((state) => state.values[feature.id]);
    const changeSetting = useModulesStore((state) => state.changeSetting);
    const valueOf = (key: string, schema: SettingSchema) => values?.[key] ?? defaultValue(schema);

    // 같은 모듈의 다른 단축키 설정이 쓰는 키. 고를 수 없게 한다. 검색으로 숨은 설정의 키도 막는다.
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
            {[...Map.groupBy(shown, ([key, schema]) => schema.group ?? key).values()].map((entries) => {
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

/** 모듈 카드. 헤더의 스위치로 켜고 끄며, 켜져 있거나 검색 중일 때 세부 설정(shown)을 펼친다. */
const ModuleCard = ({feature, shown, searching}: { feature: AnyModuleMeta; shown: SettingEntry[]; searching: boolean }) => {
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

            {shown.length > 0 && (
                // 접혀서 패널이 빠져도 이 칸은 카드의 자식으로 남아 카드 간격만큼 아래 여백이 벌어진다. 그 간격을 여기서 지운다.
                <Collapsible open={enabled || searching} className="-mt-(--card-spacing)">
                    {/* 켜고 끌 때 펼치고 접는다. 닫히는 애니메이션이 끝난 뒤 빠진다.
                        overflow-clip에 여백을 둔다. 없으면 가장자리 스위치·입력칸의 포커스 테두리가 잘린다. */}
                    <CollapsibleContent
                        className="h-(--collapsible-panel-height) overflow-clip transition-[height,opacity] duration-200 ease-out [overflow-clip-margin:6px] data-ending-style:h-0 data-ending-style:opacity-0 data-starting-style:h-0 data-starting-style:opacity-0 motion-reduce:transition-none">
                        <CardContent className="mt-2">
                            {/* 검색으로 펼친 꺼진 모듈. 값은 바꿀 수 있지만 켜야 적용되므로 흐리게 그린다. */}
                            {!enabled && <p className="pt-4 text-xs text-muted-foreground">모듈을 켜야 적용됩니다.</p>}
                            <div className={enabled ? undefined : "opacity-60"}>
                                <ModuleSettings feature={feature} settings={settings} shown={shown}/>
                            </div>
                        </CardContent>
                    </CollapsibleContent>
                </Collapsible>
            )}
        </Card>
    );
};

/**
 * 검색어(소문자)가 든 글자를 칠한다 (CSS Custom Highlight API, tailwind.css의 ::highlight).
 * DOM을 바꾸지 않아 이름·설명을 <mark>로 쪼개 그리지 않아도 된다.
 */
const useSearchHighlight = (root: RefObject<HTMLElement | null>, needle: string): void => {
    useEffect(() => {
        if (!needle || !root.current) return;

        const ranges: Range[] = [];
        const walker = document.createTreeWalker(root.current, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const text = (node.nodeValue ?? "").toLowerCase();
            for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + needle.length)) {
                const range = new Range();
                range.setStart(node, at);
                range.setEnd(node, at + needle.length);
                ranges.push(range);
            }
        }
        CSS.highlights.set("refresher-search", new Highlight(...ranges));
        return () => void CSS.highlights.delete("refresher-search");
    }, [root, needle]);
};

export function GeneralTab() {
    const [query, setQuery] = useState("");
    const needle = query.trim().toLowerCase();
    const matched = features.flatMap((feature) => {
        const shown = matchSettings(feature, needle);
        return shown ? [{feature, shown}] : [];
    });
    const root = useRef<HTMLDivElement>(null);
    useSearchHighlight(root, needle);

    return (
        <div ref={root} className="flex flex-col gap-4">
            <InputGroup>
                <InputGroupAddon>
                    <Search/>
                </InputGroupAddon>
                <InputGroupInput type="search" placeholder="설정 검색" aria-label="설정 검색" value={query} onChange={(ev) => setQuery(ev.target.value)}/>
            </InputGroup>
            {matched.map(({feature, shown}) => <ModuleCard key={feature.id} feature={feature} shown={shown} searching={Boolean(needle)}/>)}
            {matched.length === 0 && (
                <Empty>
                    <EmptyDescription>"{query.trim()}" 검색 결과 없음</EmptyDescription>
                </Empty>
            )}
        </div>
    );
}
