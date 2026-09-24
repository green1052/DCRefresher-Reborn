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

const TextControl = ({schema, value, disabled, onChange}: SettingItemProps) => {
    if (schema.type !== "text") return null;

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

const RangeControl = ({schema, value, disabled, onChange}: SettingItemProps) => {
    if (schema.type !== "range") return null;

    const [draft, setDraft] = useState(Number(value));

    useEffect(() => {
        setDraft(Number(value));
    }, [value]);

    return (
        <Slider
            size="2"
            min={schema.min}
            max={schema.max}
            step={schema.step}
            value={[draft]}
            disabled={disabled}
            onValueChange={(values) => setDraft(values[0] ?? 0)}
            onValueCommit={(values) => {
                const next = values[0];
                if (next !== undefined && next !== value) onChange(next);
            }}
        />
    );
};

const OrderControl = ({schema, value, disabled, onChange}: SettingItemProps) => {
    if (schema.type !== "order") return null;

    // 정규화 보증에도 스키마 밖 항목은 방어
    const order = [...(value as string[]).filter((key) => key in schema.items)];
    for (const key of schema.default) {
        if (key in schema.items && !order.includes(key)) order.push(key);
    }

    const move = (index: number, delta: number): void => {
        const next = [...order];
        const target = next[index];
        const swapped = next[index + delta];
        if (target === undefined || swapped === undefined) return;

        next[index] = swapped;
        next[index + delta] = target;
        onChange(next);
    };

    return (
        <Flex direction="column" gap="2" align="end">
            {order.map((key, index) => (
                <Flex key={key} align="center" gap="2">
                    <Text size="2">{schema.items[key] ?? key}</Text>
                    <Flex gap="1">
                        <Box asChild style={{padding: 0}}>
                            <button type="button" disabled={disabled || index === 0} onClick={() => move(index, -1)} aria-label="위로">
                                <Text size="2" color={disabled || index === 0 ? "gray" : undefined}>
                                    ↑
                                </Text>
                            </button>
                        </Box>
                        <Box asChild style={{padding: 0}}>
                            <button type="button" disabled={disabled || index === order.length - 1} onClick={() => move(index, 1)} aria-label="아래로">
                                <Text size="2" color={disabled || index === order.length - 1 ? "gray" : undefined}>
                                    ↓
                                </Text>
                            </button>
                        </Box>
                    </Flex>
                </Flex>
            ))}
        </Flex>
    );
};

export const SettingItem = ({schema, value, disabled, onChange}: SettingItemProps) => {
    const changed = value !== schema.default;

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
                    <Switch size="2" checked={Boolean(value)} disabled={disabled} onCheckedChange={(checked) => onChange(checked)} />
                )}
                {schema.type === "option" && (
                    <Select.Root size="2" value={String(value)} disabled={disabled} onValueChange={(selected) => onChange(selected)}>
                        <Select.Trigger style={{minWidth: 120}} />
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
