import {ChevronDown, ChevronUp, GripVertical, Undo2} from "lucide-react";
import {useId, useState} from "react";

import {ColorInput} from "@/components/ColorInput";
import {WithTooltip} from "@/components/WithTooltip";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Kbd} from "@/components/ui/kbd";
import {Slider} from "@/components/ui/slider";
import {Switch} from "@/components/ui/switch";
import {areEqual, defaultValue} from "@/core/module/settings";
import type {SettingSchema} from "@/core/module/types";
import type {SettingValue} from "@/core/storage/types";
import {pressedKey} from "@/utils/event";
import {cn} from "cn";

import {RefresherSelect} from "./RefresherSelect";

interface SettingItemProps {
    schema: SettingSchema;
    value: SettingValue;
    /** 묶음 안에서 쓸 때. 설명은 숨겨 이름의 title과 컨트롤의 aria-describedby로 돌리고 이름·컨트롤만 한 줄에 둔다. */
    compact?: boolean;
    /** key 설정 전용. 같은 모듈의 다른 key 설정이 쓰는 키라 고를 수 없다. */
    takenKeys?: string[];
    onChange: (value: SettingValue) => void;
}

type ValueOf<T extends SettingSchema["type"]> = T extends "check" ? boolean : T extends "range" ? number : T extends "order" ? string[] : string;

type NarrowProps<T extends SettingSchema["type"]> = Omit<SettingItemProps, "schema" | "value" | "onChange"> & {
    schema: Extract<SettingSchema, { type: T }>;
    value: ValueOf<T>;
    onChange: (value: ValueOf<T>) => void;
    /** 설명 글의 id. 컨트롤의 aria-describedby로 달아 포커스했을 때 설명도 읽히게 한다. */
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

/**
 * 저장 전 편집값. 저장값이 바뀌면(되돌리기·다른 탭) 따라간다.
 * effect가 아니라 렌더 중에 비교해야 옛 값이 한 번 그려지지 않는다.
 */
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
                // React onChange는 input 이벤트라 드래그마다 불린다. 창을 닫을 때만 오는 네이티브 change는 직접 듣는다.
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
        <Input
            aria-label={schema.name}
            aria-describedby={descId}
            placeholder={schema.placeholder ?? String(schema.default)}
            value={draft}
            onChange={(ev) => setDraft(ev.target.value)}
            onBlur={() => {
                if (draft !== value) onChange(draft);
            }}
            onKeyDown={(ev) => ev.key === "Enter" && !ev.nativeEvent.isComposing && ev.currentTarget.blur()}
        />
    );
};

/**
 * 단축키 하나. 버튼을 누른 뒤 원하는 키를 치면 바뀐다(영문·숫자만, 다른 키는 취소).
 * 다른 단축키가 쓰는 키면 알려 주고 계속 기다린다.
 */
const KeyControl = ({schema, value, takenKeys = [], descId, onChange}: NarrowProps<"key">) => {
    const [listening, setListening] = useState(false);
    const [taken, setTaken] = useState("");
    // 스크린 리더에 화면 글자와 같은 내용을 준다. 이름만 주면 '키 입력…'·'이미 사용 중'이 들리지 않는다.
    const shown = taken ? `${taken.toUpperCase()}: 이미 사용 중` : listening ? "키 입력…" : value.toUpperCase();

    return (
        <Button variant={taken ? "destructive" : listening ? "default" : "secondary"} className="min-w-18"
                aria-label={`${schema.name}: ${shown}`}
                aria-describedby={descId}
                onClick={() => setListening(true)}
                onBlur={() => {
                    setListening(false);
                    setTaken("");
                }}
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
                    setListening(false);
                    setTaken("");
                }}>
            {taken || listening ? shown : <Kbd>{shown}</Kbd>}
        </Button>
    );
};

const RangeControl = ({schema, value, descId, onChange}: NarrowProps<"range">) => {
    // 화살표 키는 한 칸마다 commit하므로 저장값은 useDraft로 따라간다. key로 다시 마운트해 맞추면 그때마다 포커스를 잃는다.
    const [draft, setDraft] = useDraft(value);
    const text = formatRange(draft, schema.unit);

    return (
        <div className="flex w-60 items-center gap-3">
            <Slider
                className="flex-1"
                min={schema.min}
                max={schema.max}
                step={schema.step}
                // 배열로 준다. 숫자를 주면 Slider 부품이 손잡이를 둘(최솟값·최댓값) 그린다.
                value={[draft]}
                // 이름·설명·읽는 값은 손잡이(role=slider)에 달아야 읽힌다. 그대로 두면 이름 없이 저장값(ms)만 읽힌다.
                thumbProps={{"aria-label": schema.name, "aria-describedby": descId, getAriaValueText: () => text}}
                onValueChange={(next) => {
                    const [first] = typeof next === "number" ? [next] : next;
                    if (first !== undefined) setDraft(first);
                }}
                onValueCommitted={(next) => {
                    const [first] = typeof next === "number" ? [next] : next;
                    if (first !== undefined && first !== value) onChange(first);
                }}
            />
            <span className="min-w-14 text-right font-bold tabular-nums">{text}</span>
        </div>
    );
};

const OrderControl = ({schema, value: order, descId, onChange}: NarrowProps<"order">) => {
    const [dragging, setDragging] = useState<number | null>(null);
    const [over, setOver] = useState<number | null>(null);

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
        <div className="flex min-w-50 flex-col gap-1" role="group" aria-label={schema.name} aria-describedby={descId}>
            {order.map((key, index) => (
                <div
                    key={key}
                    className={cn(
                        "flex cursor-grab items-center gap-2 rounded-md border bg-background py-1 pr-1 pl-2",
                        dragging === index && "opacity-40",
                        over === index && dragging !== null && "bg-primary/10"
                    )}
                    draggable
                    onDragStart={(ev) => {
                        // Firefox는 dataTransfer에 데이터가 없으면 드래그를 시작하지 않는다.
                        ev.dataTransfer.setData("text/plain", String(index));
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
                    <Button variant="ghost" size="icon-xs" aria-label={`${label(key)} 위로`}
                            disabled={index === 0} onClick={() => move(index, index - 1)}>
                        <ChevronUp/>
                    </Button>
                    <Button variant="ghost" size="icon-xs" aria-label={`${label(key)} 아래로`}
                            disabled={index === order.length - 1} onClick={() => move(index, index + 1)}>
                        <ChevronDown/>
                    </Button>
                </div>
            ))}
        </div>
    );
};

export const SettingItem = ({schema, value, compact, takenKeys, onChange}: SettingItemProps) => {
    const descId = useId();
    // 스토어가 normalizeSetting으로 스키마에 맞춰 둔 값이다. 모양이 다르면(있을 수 없지만) 기본값으로 그린다.
    const text = typeof value === "string" ? value : String(defaultValue(schema));
    const title = (
        <div className="flex items-center gap-1">
            <span className="font-medium" title={compact ? schema.desc : undefined}>{schema.name}</span>
            {/* 다른 단축키가 기본값 키를 쓰고 있으면 되돌리지 못하게 한다. 되돌리면 두 단축키가 같은 키가 된다. */}
            {!areEqual(value, defaultValue(schema)) && !(schema.type === "key" && takenKeys?.includes(schema.default)) && (
                <WithTooltip tip={`기본값으로 되돌리기 (${formatDefault(schema)})`}
                             trigger={<Button variant="ghost" size="icon-xs" aria-label={`${schema.name} 기본값으로 되돌리기`} onClick={() => onChange(defaultValue(schema))}/>}>
                    <Undo2/>
                </WithTooltip>
            )}
        </div>
    );

    return (
        <div className={cn("flex items-center justify-between", compact ? "gap-2 py-1" : "flex-wrap gap-4 py-3 sm:flex-nowrap")}>
            <div className="min-w-0 grow">
                {title}
                {/* 묶음에서는 설명을 숨긴다. 마우스는 이름의 title로, 키보드·스크린 리더는 컨트롤의 aria-describedby로 읽는다. */}
                {compact ? (
                    <span id={descId} hidden>{schema.desc}</span>
                ) : (
                    <p id={descId} className="text-xs text-muted-foreground">{schema.desc}</p>
                )}
            </div>

            <div className="shrink-0">
                {schema.type === "check" && (
                    <Switch aria-label={schema.name} aria-describedby={descId} checked={value === true}
                            onCheckedChange={(checked) => onChange(checked)}/>
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
