import {ChevronDown, ChevronUp, GripVertical, Undo2} from "lucide-react";
import {useId, useLayoutEffect, useRef, useState} from "react";
import {shallow} from "zustand/shallow";

import {ColorInput} from "@/components/ColorInput";
import {WithTooltip} from "@/components/WithTooltip";
import {defaultValue} from "@/core/module/settings";
import type {LabeledSetting, SettingSchema} from "@/core/module/types";
import type {SettingValue} from "@/core/storage/types";
import {pressedKey} from "@/utils/event";
import {cn} from "cn";

import {RefresherSelect} from "../shared/RefresherSelect";

interface SettingItemProps {
    schema: LabeledSetting;
    value: SettingValue;
    /** 묶음용 - 설명을 숨기고 이름과 컨트롤만 한 줄에 둔다. */
    compact?: boolean;
    /** key 설정 전용. 같은 모듈의 다른 key 설정이 쓰는 키라 고를 수 없다. */
    takenKeys?: string[];
    onChange: (value: SettingValue) => void;
}

type ValueOf<T extends SettingSchema["type"]> = T extends "check" ? boolean : T extends "range" ? number : T extends "order" ? string[] : string;

type NarrowProps<T extends SettingSchema["type"]> = Omit<SettingItemProps, "schema" | "value" | "onChange"> & {
    schema: Extract<LabeledSetting, { type: T }>;
    value: ValueOf<T>;
    onChange: (value: ValueOf<T>) => void;
    /** aria-describedby로 달아 포커스 때 설명도 읽히게 하는 id. */
    descId: string;
};

/** 범위 값 표시. 저장은 ms 그대로 하고, 보여 줄 때만 초로 바꾼다(5000ms → 5초). */
const formatRange = (value: number, unit: string): string => (unit === "ms" ? `${value / 1000}초` : `${value}${unit}`);



const formatDefault = (schema: SettingSchema): string => {
    switch (schema.type) {
        case "check":
            return schema.default ? "사용" : "미사용";
        case "range":
            return formatRange(schema.default, schema.unit);
        case "option":
            return schema.items[schema.default] ?? schema.default;
        case "order":
            return schema.default.map((key) => schema.items[key] ?? key).join(", ");
        case "key":
            return schema.default.toUpperCase();
        default:
            return String(schema.default) || "비어 있음";
    }
};

// 저장값이 바뀌면(되돌리기, 다른 탭) 따라간다 - 렌더 중에 비교해야 옛 값이 안 그려진다.
const useDraft = <T, >(value: T): [T, (next: T) => void] => {
    const [draft, setDraft] = useState(value);
    const [synced, setSynced] = useState(value);
    if (synced !== value) {
        setSynced(value);
        setDraft(value);
    }
    return [draft, setDraft];
};

/** 색 선택. 드래그 중에는 미리보기만 바꾸고, 선택 창을 닫을 때(네이티브 change) 저장한다. */
const ColorControl = ({schema, value, compact, descId, onChange}: NarrowProps<"color">) => {
    const [draft, setDraft] = useDraft(value);

    return (
        <div className="flex items-center gap-2">
            {!compact && <span className="text-muted-foreground tabular-nums">{draft}</span>}
            <ColorInput
                aria-label={schema.name}
                aria-describedby={descId}
                title={draft}
                value={draft}
                onChange={(ev) => setDraft(ev.target.value)}
                // React의 onChange는 input 이벤트라 드래그마다 불린다. 창을 닫을 때만 오는 네이티브 change는 직접 듣는다.
                ref={(element) => {
                    if (!element) return;
                    const commit = (): void => onChange(element.value);
                    element.addEventListener("change", commit);
                    return () => element.removeEventListener("change", commit);
                }}
            />
        </div>
    );
};

const TextControl = ({schema, value, descId, onChange}: NarrowProps<"text">) => {
    const [draft, setDraft] = useDraft(value);

    return (
        <input
            className="input w-full"
            aria-label={schema.name}
            aria-describedby={descId}
            placeholder={schema.placeholder ?? String(schema.default)}
            maxLength={schema.maxLength}
            value={draft}
            onChange={(ev) => setDraft(ev.target.value)}
            onBlur={() => {
                if (draft !== value) onChange(draft);
            }}
            onKeyDown={(ev) => ev.key === "Enter" && !ev.nativeEvent.isComposing && ev.currentTarget.blur()}
        />
    );
};

// 버튼을 누른 뒤 키를 치면 바뀐다(영문, 숫자만) - 다른 단축키가 쓰는 키면 알리고 계속 기다린다.
const KeyControl = ({schema, value, takenKeys = [], descId, onChange}: NarrowProps<"key">) => {
    const [listening, setListening] = useState(false);
    const [taken, setTaken] = useState("");
    // 스크린 리더에 화면 글자와 같은 내용을 준다. 이름만 주면 '키 입력...', '이미 사용 중'이 들리지 않는다.
    const shown = taken ? `${taken.toUpperCase()}: 이미 사용 중` : listening ? "키 입력..." : value.toUpperCase();
    const stop = (): void => {
        setListening(false);
        setTaken("");
    };

    return (
        <button type="button" className={cn("btn min-w-18", taken ? "btn-error" : listening ? "btn-primary" : "btn-secondary")}
                aria-label={`${schema.name}: ${shown}`}
                aria-describedby={descId}
                onClick={() => setListening(true)}
                onBlur={stop}
                onKeyDown={(ev) => {
                    if (!listening) return;
                    // Tab은 막지 않고 녹음을 끝낸다. 막으면 키보드로 이 칸을 빠져나갈 수 없다.
                    if (ev.key !== "Tab") ev.preventDefault();

                    const key = pressedKey(ev);
                    const valid = /^[a-z0-9]$/.test(key);
                    if (valid && key !== value && takenKeys.includes(key)) {
                        setTaken(key);
                        return;
                    }
                    if (valid) onChange(key);
                    stop();
                }}>
            {taken || listening ? shown : <kbd className="kbd kbd-sm">{shown}</kbd>}
        </button>
    );
};

const RangeControl = ({schema, value, descId, onChange}: NarrowProps<"range">) => {
    // 화살표 키는 한 칸마다 commit하므로 저장값은 useDraft로 따라간다. key로 다시 마운트해 맞추면 그때마다 포커스를 잃는다.
    const [draft, setDraft] = useDraft(value);
    const text = formatRange(draft, schema.unit);

    return (
        <div className="flex w-60 items-center gap-3">
            {/* 드래그 중(input)에는 미리보기만 바꾸고, 놓을 때(네이티브 change) 저장한다. */}
            <input
                type="range"
                className="range range-primary flex-1"
                min={schema.min}
                max={schema.max}
                step={schema.step}
                value={draft}
                // 이름, 설명, 읽는 값은 input에 달아야 읽힌다. 그대로 두면 이름 없이 백분율만 읽힌다.
                aria-label={schema.name}
                aria-describedby={descId}
                aria-valuetext={text}
                onChange={(ev) => setDraft(Number(ev.target.value))}
                ref={(element) => {
                    if (!element) return;
                    const commit = (): void => {
                        if (element.valueAsNumber !== value) onChange(element.valueAsNumber);
                    };
                    element.addEventListener("change", commit);
                    return () => element.removeEventListener("change", commit);
                }}
            />
            <span className="min-w-14 text-right font-bold tabular-nums">{text}</span>
        </div>
    );
};

/** 포커스를 받을 수 있는 요소 (막힌 것과 tabindex -1은 뺀다). */
const FOCUSABLE = ":is(button, input, [tabindex]:not([tabindex='-1'])):not(:disabled)";

// 누른 버튼이 사라져 포커스가 body로 떨어졌으면 within 안의 포커스 받을 곳으로 옮긴다.
const refocus = (within: Element | null | undefined): void => {
    const active = document.activeElement;
    if (active && active !== document.body && !(active instanceof HTMLButtonElement && active.disabled)) return;
    within?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
};

const OrderControl = ({schema, value: order, descId, onChange}: NarrowProps<"order">) => {
    const [dragging, setDragging] = useState<number | null>(null);
    const [over, setOver] = useState<number | null>(null);
    const group = useRef<HTMLDivElement>(null);
    // 버튼으로 옮긴 항목. 끝으로 옮기면 누른 버튼이 막히므로 다시 그린 뒤 같은 항목의 다른 버튼으로 옮긴다.
    const moved = useRef<string | null>(null);
    useLayoutEffect(() => {
        if (moved.current === null) return;
        refocus(group.current?.querySelector(`[data-key="${CSS.escape(moved.current)}"]`));
        moved.current = null;
    }, [order]);

    const label = (key: string): string => schema.items[key] ?? key;

    const move = (from: number, to: number): void => {
        const next = [...order];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved!);
        onChange(next);
    };

    const drop = (to: number): void => {
        if (dragging !== null && dragging !== to) move(dragging, to);
        setDragging(null);
        setOver(null);
    };

    return (
        <div ref={group} className="flex min-w-50 flex-col gap-1" role="group" aria-label={schema.name} aria-describedby={descId}>
            {order.map((key, index) => (
                <div
                    key={key}
                    data-key={key}
                    className={cn(
                        "flex cursor-grab items-center gap-2 rounded-md border bg-background py-1 pr-1 pl-2",
                        dragging === index && "opacity-40",
                        over === index && dragging !== null && "bg-primary/10"
                    )}
                    draggable
                    onDragStart={(ev) => {
                        // Firefox는 dataTransfer가 비면 드래그를 시작하지 않는다 - 입력칸에 떨어뜨려도 안 들어가는 종류로 둔다.
                        ev.dataTransfer.setData("application/x-refresher-order", String(index));
                        ev.dataTransfer.effectAllowed = "move";
                        setDragging(index);
                    }}
                    onDragEnd={() => {
                        setDragging(null);
                        setOver(null);
                    }}
                    onDragOver={(ev) => {
                        ev.preventDefault();
                        setOver(index);
                    }}
                    onDragLeave={() => setOver(null)}
                    onDrop={(ev) => {
                        ev.preventDefault();
                        drop(index);
                    }}
                >
                    <GripVertical className="size-3.5 text-muted-foreground"/>
                    <span className="flex-1">{label(key)}</span>
                    {/* 버튼마다 항목 이름을 붙인다. '위로'만 있으면 어느 항목을 옮기는지 들리지 않는다. */}
                    <button type="button" className="btn btn-ghost btn-square btn-xs" aria-label={`${label(key)} 위로`}
                            disabled={index === 0} onClick={() => {
                                moved.current = key;
                                move(index, index - 1);
                            }}>
                        <ChevronUp className="size-3"/>
                    </button>
                    <button type="button" className="btn btn-ghost btn-square btn-xs" aria-label={`${label(key)} 아래로`}
                            disabled={index === order.length - 1} onClick={() => {
                                moved.current = key;
                                move(index, index + 1);
                            }}>
                        <ChevronDown className="size-3"/>
                    </button>
                </div>
            ))}
        </div>
    );
};

export const SettingItem = ({schema, value, compact, takenKeys, onChange}: SettingItemProps) => {
    const descId = useId();
    // 기본값으로 되돌리면 그 버튼이 사라진다. 포커스는 이 설정의 컨트롤로 옮긴다.
    const control = useRef<HTMLDivElement>(null);
    // 스토어가 normalizeSetting으로 스키마에 맞춰 둔 값이다. 모양이 다르면(있을 수 없지만) 기본값으로 그린다.
    const text = typeof value === "string" ? value : String(defaultValue(schema));
    const title = (
        <div className="flex items-center gap-1">
            <span className="font-medium" title={compact ? schema.desc : undefined}>{schema.name}</span>
            {/* 다른 단축키가 기본값 키를 쓰고 있으면 되돌리지 못하게 한다. 되돌리면 두 단축키가 같은 키가 된다. */}
            {!shallow(value, defaultValue(schema)) && !(schema.type === "key" && takenKeys?.includes(schema.default)) && (
                <WithTooltip tip={`기본값으로 되돌리기 (${formatDefault(schema)})`}
                             trigger={<button type="button" className="btn btn-ghost btn-square btn-xs" aria-label={`${schema.name} 기본값으로 되돌리기`} onClick={() => {
                                 onChange(defaultValue(schema));
                                 requestAnimationFrame(() => refocus(control.current));
                             }}/>}>
                    <Undo2 className="size-3"/>
                </WithTooltip>
            )}
        </div>
    );

    return (
        <div className={cn("flex items-center justify-between", compact ? "gap-2 py-1" : "flex-wrap gap-4 py-3 sm:flex-nowrap")}>
            <div className="min-w-0 grow">
                {title}
                {/* 묶음에서는 설명을 숨긴다. 마우스는 이름의 title로, 키보드, 스크린 리더는 컨트롤의 aria-describedby로 읽는다. */}
                {compact ? (
                    <span id={descId} hidden>{schema.desc}</span>
                ) : (
                    <p id={descId} className="text-xs text-muted-foreground">{schema.desc}</p>
                )}
            </div>

            <div ref={control} className="shrink-0">
                {schema.type === "check" && (
                    <input type="checkbox" role="switch" className="toggle"
                           aria-label={schema.name} aria-describedby={descId} checked={value === true}
                           onChange={(ev) => onChange(ev.target.checked)}/>
                )}
                {schema.type === "option" && (
                    <RefresherSelect value={text} aria-label={schema.name} aria-describedby={descId} options={schema.items}
                                     onChange={onChange}/>
                )}
                {schema.type === "text" && <TextControl {...{schema, value: text, descId, onChange}} />}
                {schema.type === "color" && <ColorControl {...{schema, value: text, compact, descId, onChange}} />}
                {schema.type === "range" && <RangeControl {...{schema, value: typeof value === "number" ? value : schema.default, descId, onChange}} />}
                {schema.type === "order" && <OrderControl {...{schema, value: Array.isArray(value) ? value : [...schema.default], descId, onChange}} />}
                {schema.type === "key" && <KeyControl {...{schema, value: text, takenKeys, descId, onChange}} />}
            </div>
        </div>
    );
};
