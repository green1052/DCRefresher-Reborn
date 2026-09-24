import {Box, Flex, Select, Slider, Switch, Text, TextField} from "@radix-ui/themes";
import {useEffect, useState} from "react";

import type {SettingSchema} from "@/core/module/types";
import type {SettingValue} from "@/core/storage/types";

interface SettingItemProps {
    schema: SettingSchema;
    value: SettingValue;
    disabled?: boolean;
    onChange: (value: SettingValue) => void;
}

type NarrowProps<T extends SettingSchema["type"]> = Omit<SettingItemProps, "schema"> & {
    schema: Extract<SettingSchema, { type: T }>
};

const formatDefault = (schema: SettingSchema): string => {
    switch (schema.type) {
        case "check":
            return schema.default ? "사용" : "미사용";
        case "range":
            return `${schema.default}${schema.unit}`;
        case "order":
            return schema.default.map((key) => schema.items[key] ?? key).join(", ");
        default:
            return String(schema.default);
    }
};

const TextControl = ({schema, value, disabled, onChange}: NarrowProps<"text">) => {
    const [draft, setDraft] = useState(String(value));

    useEffect(() => {
        setDraft(String(value));
    }, [value]);

    return (
        <TextField.Root
            size="2"
            placeholder={String(schema.default)}
            value={draft}
            disabled={disabled}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
                if (draft !== value) onChange(draft);
            }}
            onKeyDown={(event) => event.key === "Enter" && (event.target as HTMLInputElement).blur()}
        />
    );
};

const RangeControl = ({schema, value, disabled, onChange}: NarrowProps<"range">) => {
    // NaN 방어: value가 undefined/문자열이면 기본값으로 (NaN이면 thumb 위치 계산이 깨짐)
    const initial = Number(value);
    const [draft, setDraft] = useState(Number.isFinite(initial) ? initial : schema.default);

    useEffect(() => {
        const next = Number(value);
        setDraft(Number.isFinite(next) ? next : schema.default);
    }, [value, schema.default]);

    // rt-SliderRoot는 width:stretch(부모 100%) — 부모 폭을 고정해야 트랙이 그려짐
    return (
        <Flex align="center" gap="3" style={{width: 240}}>
            <Slider
                size="2"
                min={schema.min}
                max={schema.max}
                step={schema.step}
                value={[draft]}
                disabled={disabled}
                style={{flex: 1}}
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
                {draft}
                {schema.unit}
            </Text>
        </Flex>
    );
};

const OrderControl = ({schema, value, disabled, onChange}: NarrowProps<"order">) => {
    const [dragging, setDragging] = useState<number | null>(null);
    const [over, setOver] = useState<number | null>(null);

    // 정규화 보증에도 스키마 밖 항목은 방어
    const order = [...(value as string[]).filter((key) => key in schema.items)];
    for (const key of schema.default) {
        if (key in schema.items && !order.includes(key)) order.push(key);
    }

    const drop = (to: number): void => {
        if (dragging === null || dragging === to) {
            setDragging(null);
            setOver(null);
            return;
        }

        const next = [...order];
        const [moved] = next.splice(dragging, 1);
        next.splice(to, 0, moved!);
        onChange(next);
        setDragging(null);
        setOver(null);
    };

    return (
        <Flex direction="column" gap="1" style={{minWidth: 180}}>
            {order.map((key, index) => (
                <Flex
                    key={key}
                    align="center"
                    gap="2"
                    py="1"
                    px="2"
                    style={{
                        borderRadius: 6,
                        cursor: disabled ? "default" : "grab",
                        opacity: dragging === index ? 0.4 : 1,
                        background: over === index && dragging !== null ? "var(--gray-a3)" : undefined
                    }}
                    draggable={!disabled}
                    onDragStart={() => setDragging(index)}
                    onDragEnd={() => {
                        setDragging(null);
                        setOver(null);
                    }}
                    onDragOver={(event) => {
                        if (disabled) return;
                        event.preventDefault();
                        setOver(index);
                    }}
                    onDragLeave={() => setOver(null)}
                    onDrop={(event) => {
                        event.preventDefault();
                        drop(index);
                    }}
                >
                    <Text size="2" style={{flex: 1}}>
                        {schema.items[key] ?? key}
                    </Text>
                </Flex>
            ))}
        </Flex>
    );
};

/** 배열(order)은 요소 비교 — 원복했는데도 참조 차이로 changed로 오판하지 않게 */
const isChanged = (schema: SettingSchema, value: SettingValue): boolean => {
    if (Array.isArray(schema.default) && Array.isArray(value)) {
        return schema.default.length !== value.length || schema.default.some((item, index) => item !== value[index]);
    }
    return value !== schema.default;
};

export const SettingItem = ({schema, value, disabled, onChange}: SettingItemProps) => {
    const changed = isChanged(schema, value);

    return (
        <Flex justify="between" align="center" gap="3" py="2">
            <Box style={{flex: 1, minWidth: 0}}>
                <Text as="div" size="2" weight={changed ? "bold" : "regular"}>
                    {schema.name}
                    {changed && (
                        <Text color="blue">
                            {" "}
                            •
                        </Text>
                    )}
                </Text>
                <Text as="div" size="2" color="gray">
                    {schema.desc}
                </Text>
                <Text as="div" size="2" color="gray">
                    기본 값 : {formatDefault(schema)}
                </Text>
            </Box>

            <Box>
                {schema.type === "check" && (
                    <Switch size="2" checked={Boolean(value)} disabled={disabled}
                            onCheckedChange={(checked) => onChange(checked)}/>
                )}
                {schema.type === "option" && (
                    <Select.Root size="2" value={String(value)} disabled={disabled}
                                 onValueChange={(selected) => onChange(selected)}>
                        <Select.Trigger style={{minWidth: 120}}/>
                        <Select.Content>
                            {Object.entries(schema.items).map(([key, label]) => (
                                <Select.Item key={key} value={key}>
                                    {label}
                                </Select.Item>
                            ))}
                        </Select.Content>
                    </Select.Root>
                )}
                {schema.type === "text" && <TextControl {...{schema, value, disabled, onChange}} />}
                {schema.type === "range" && <RangeControl {...{schema, value, disabled, onChange}} />}
                {schema.type === "order" && <OrderControl {...{schema, value, disabled, onChange}} />}
            </Box>
        </Flex>
    );
};
