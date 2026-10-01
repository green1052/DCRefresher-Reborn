import {Box, Button, Flex, IconButton, Kbd, Slider, Switch, Text, TextField, Tooltip} from "@radix-ui/themes";
import {ChevronDown, ChevronUp, GripVertical, Undo2} from "lucide-react";
import {useId, useState} from "react";

import {RefresherSelect} from "@/components/RefresherSelect";
import {areEqual, defaultValue} from "@/core/module/settings";
import type {SettingSchema} from "@/core/module/types";
import type {SettingValue} from "@/core/storage/types";
import {pressedKey} from "@/utils/event";

interface SettingItemProps {
    schema: SettingSchema;
    value: SettingValue;
    /** 묶음 안에서 쓸 때. 설명은 숨겨 이름의 title과 컨트롤의 aria-describedby로 돌리고 이름·컨트롤만 한 줄에 둔다. */
    compact?: boolean;
    /** key 설정 전용. 같은 모듈의 다른 key 설정이 쓰는 키라 고를 수 없다. */
    takenKeys?: string[];
    onChange: (value: SettingValue) => void;
}

/** 설정 종류별 값 타입. */
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
        <Flex align="center" gap="2">
            {!compact && <Text size="2" color="gray" style={{fontVariantNumeric: "tabular-nums"}}>{draft}</Text>}
            <input
                type="color"
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
                style={{width: 36, height: 28, padding: 0, border: 0, background: "none", cursor: "pointer"}}
            />
        </Flex>
    );
};

const TextControl = ({schema, value, descId, onChange}: NarrowProps<"text">) => {
    const [draft, setDraft] = useDraft(value);

    return (
        <TextField.Root
            size="2"
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
        <Button size="2" variant="soft" color={taken ? "red" : listening ? undefined : "gray"} style={{minWidth: 72}}
                aria-label={`${schema.name}: ${shown}`}
                aria-describedby={descId}
                onClick={() => setListening(true)}
                onBlur={() => {
                    setListening(false);
                    setTaken("");
                }}
                onKeyDown={(ev) => {
                    if (!listening) return;
                    ev.preventDefault();

                    const key = pressedKey(ev);
                    if (/^[a-z0-9]$/.test(key) && key !== value && takenKeys.includes(key)) {
                        setTaken(key);
                        return;
                    }
                    if (/^[a-z0-9]$/.test(key)) onChange(key);
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

    // rt-SliderRoot는 width:stretch(부모의 100%)라 부모 폭을 고정해야 트랙이 그려진다.
    return (
        <Flex align="center" gap="3" style={{width: 240}}>
            <Slider
                size="2"
                min={schema.min}
                max={schema.max}
                step={schema.step}
                value={[draft]}
                style={{flex: 1}}
                // Themes Slider는 role=slider인 thumb에 속성을 넘길 수 없다(aria-label도 root로 간다). 그대로 두면 이름 없이
                // 저장값(ms)만 읽히므로 thumb에 직접 단다. 값이 바뀌면 ref가 새로 불려 aria-valuetext도 따라간다.
                ref={(root) => {
                    const thumb = root?.querySelector("[role=slider]");
                    thumb?.setAttribute("aria-label", schema.name);
                    thumb?.setAttribute("aria-describedby", descId);
                    thumb?.setAttribute("aria-valuetext", text);
                }}
                onValueChange={(values) => {
                    const next = values[0];
                    if (next !== undefined) setDraft(next);
                }}
                onValueCommit={(values) => {
                    const next = values[0];
                    if (next !== undefined && next !== value) onChange(next);
                }}
            />
            <Text size="2" weight="bold" style={{minWidth: 56, textAlign: "right", fontVariantNumeric: "tabular-nums"}}>
                {text}
            </Text>
        </Flex>
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
        <Flex direction="column" gap="1" minWidth="200px" role="group" aria-label={schema.name} aria-describedby={descId}>
            {order.map((key, index) => (
                <Flex
                    key={key}
                    align="center"
                    gap="2"
                    py="1"
                    pl="2"
                    pr="1"
                    style={{
                        borderRadius: "var(--radius-2)",
                        border: "1px solid var(--gray-a5)",
                        cursor: "grab",
                        opacity: dragging === index ? 0.4 : 1,
                        background: over === index && dragging !== null ? "var(--accent-a3)" : "var(--color-surface)"
                    }}
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
                    <GripVertical size={14} color="var(--gray-9)"/>
                    <Text size="2" style={{flex: 1}}>
                        {label(key)}
                    </Text>
                    {/* 버튼마다 항목 이름을 붙인다. '위로'만 있으면 어느 항목을 옮기는지 들리지 않는다. */}
                    <IconButton size="1" variant="ghost" color="gray" aria-label={`${label(key)} 위로`}
                                disabled={index === 0} onClick={() => move(index, index - 1)}>
                        <ChevronUp size={14}/>
                    </IconButton>
                    <IconButton size="1" variant="ghost" color="gray" aria-label={`${label(key)} 아래로`}
                                disabled={index === order.length - 1}
                                onClick={() => move(index, index + 1)}>
                        <ChevronDown size={14}/>
                    </IconButton>
                </Flex>
            ))}
        </Flex>
    );
};

export const SettingItem = ({schema, value, compact, takenKeys, onChange}: SettingItemProps) => {
    const descId = useId();
    // 스토어가 normalizeSetting으로 스키마에 맞춰 둔 값이다. 모양이 다르면(있을 수 없지만) 기본값으로 그린다.
    const text = typeof value === "string" ? value : String(defaultValue(schema));
    const title = (
        <Flex align="center" gap="1">
            <Text size="2" weight="medium" title={compact ? schema.desc : undefined}>
                {schema.name}
            </Text>
            {/* 다른 단축키가 기본값 키를 쓰고 있으면 되돌리지 못하게 한다. 되돌리면 두 단축키가 같은 키가 된다. */}
            {!areEqual(value, defaultValue(schema)) && !(schema.type === "key" && takenKeys?.includes(schema.default)) && (
                <Tooltip content={`기본값으로 되돌리기 (${formatDefault(schema)})`}>
                    <IconButton size="1" variant="ghost" color="gray" aria-label={`${schema.name} 기본값으로 되돌리기`}
                                onClick={() => onChange(defaultValue(schema))}>
                        <Undo2 size={14}/>
                    </IconButton>
                </Tooltip>
            )}
        </Flex>
    );

    return (
        <Flex justify="between" align="center" gap={compact ? "2" : "4"} py={compact ? "1" : "3"} wrap={compact ? "nowrap" : {initial: "wrap", sm: "nowrap"}}>
            <Box flexGrow="1" minWidth="0">
                {title}
                {/* 묶음에서는 설명을 숨긴다. 마우스는 이름의 title로, 키보드·스크린 리더는 컨트롤의 aria-describedby로 읽는다. */}
                {compact ? (
                    <span id={descId} hidden>{schema.desc}</span>
                ) : (
                    <Text as="p" id={descId} size="1" color="gray">
                        {schema.desc}
                    </Text>
                )}
            </Box>

            <Box flexShrink="0">
                {schema.type === "check" && (
                    <Switch size="2" aria-label={schema.name} aria-describedby={descId} checked={value === true}
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
            </Box>
        </Flex>
    );
};
