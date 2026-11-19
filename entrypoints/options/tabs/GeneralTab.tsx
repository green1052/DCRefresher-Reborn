import {Fragment, type RefObject, useEffect, useRef, useState} from "react";

import {useCollapse} from "@/components/useCollapse";
import {defaultValue} from "@/core/module/settings";
import type {LabeledSetting, ModuleInfo} from "@/core/module/types";
import features from "@/features/meta";
import {useModulesStore} from "@/stores/modules";
import {SAVE_FAILED} from "@/utils/error";

import {EmptyList, SearchInput} from "../shared/widgets";
import {notify} from "../optionsStore";
import {SettingItem} from "./SettingItem";

type SettingEntry = [key: string, schema: LabeledSetting];

// 모듈 이름, 설명이 맞으면 그 모듈 전부, 아니면 맞는 설정만 - 없으면 undefined.
export const matchSettings = (feature: Pick<ModuleInfo, "name" | "description" | "settings">, needle: string): SettingEntry[] | undefined => {
    const settings = Object.entries(feature.settings ?? {});
    const has = (...texts: string[]) => texts.some((text) => text.toLowerCase().includes(needle));
    if (has(feature.name, feature.description)) return settings;
    const matched = settings.filter(([, schema]) => has(schema.name, schema.desc, schema.group?.name ?? ""));
    return matched.length > 0 ? matched : undefined;
};

const ModuleSettings = ({feature, settings, shown}: { feature: ModuleInfo; settings: SettingEntry[]; shown: SettingEntry[] }) => {
    // 이 모듈의 값만 구독한다. 다른 모듈의 설정을 바꿔도 이 카드는 다시 그리지 않는다.
    const values = useModulesStore((state) => state.values[feature.id]);
    const changeSetting = useModulesStore((state) => state.changeSetting);
    const valueOf = (key: string, schema: LabeledSetting) => values?.[key] ?? defaultValue(schema);

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
                        <div role="none" className="divider m-0"/>
                        {group ? (
                            <div className="py-3" role="group" aria-label={group.name}>
                                <p className="font-medium">{group.name}</p>
                                <p className="mb-2 text-xs text-base-content/60">{group.desc}</p>
                                {/* 글 입력칸, 슬라이더는 칸 하나에 넣기엔 좁다. 섞여 있으면 묶음 전체를 한 줄에 하나씩 그려 조작부를 오른쪽 끝에 맞춘다. */}
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

const ModuleCard = ({feature, shown, searching}: { feature: ModuleInfo; shown: SettingEntry[]; searching: boolean }) => {
    const enabled = useModulesStore((state) => state.enables[feature.id] === true);
    const toggle = useModulesStore((state) => state.toggle);
    const settings = Object.entries(feature.settings ?? {});

    const collapse = useCollapse(enabled || searching);

    return (
        <section data-slot="card" className="card card-border flex flex-col gap-6 py-6">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6">
                <div className="min-w-0">
                    <h2 className="text-base font-medium">{feature.name}</h2>
                    <p className="text-sm text-base-content/60">{feature.description}</p>
                </div>
                <input
                    type="checkbox"
                    role="switch"
                    className="toggle"
                    checked={enabled}
                    aria-label={`${feature.name} 사용`}
                    onChange={(ev) => void toggle(feature.id, ev.target.checked).catch(() => notify(SAVE_FAILED))}
                />
            </div>

            {shown.length > 0 && (
                // 접혀서 패널이 빠져도 이 칸은 카드의 자식으로 남아 카드 간격만큼 아래 여백이 벌어진다. 그 간격을 여기서 지운다.
                <div className="-mt-6">
                    {/* overflow-clip에 여백을 둔다. 없으면 가장자리 스위치, 입력칸의 포커스 테두리가 잘린다. */}
                    {collapse.render && (
                        <div
                            ref={collapse.ref}
                            style={collapse.style}
                            onTransitionEnd={collapse.onTransitionEnd}
                            className="overflow-clip transition-[height,opacity] duration-200 ease-out [overflow-clip-margin:6px] motion-reduce:transition-none"
                        >
                            <div className="mt-2 flex flex-col gap-3 px-6">
                                {/* 검색으로 펼친 꺼진 모듈. 값은 바꿀 수 있지만 켜야 적용되므로 흐리게 그린다. */}
                                {!enabled && <p className="pt-4 text-xs text-base-content/60">모듈을 켜야 적용됩니다.</p>}
                                <div className={enabled ? undefined : "opacity-60"}>
                                    <ModuleSettings feature={feature} settings={settings} shown={shown}/>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
};

// CSS Custom Highlight API로 검색어를 칠한다 - DOM을 바꾸지 않아 mark로 쪼갤 필요가 없다.
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
            <SearchInput placeholder="설정 검색" aria-label="설정 검색" value={query} onChange={(ev) => setQuery(ev.target.value)}/>
            {matched.map(({feature, shown}) => <ModuleCard key={feature.id} feature={feature} shown={shown} searching={Boolean(needle)}/>)}
            {matched.length === 0 && <EmptyList>"{query.trim()}" 검색 결과 없음</EmptyList>}
        </div>
    );
}
