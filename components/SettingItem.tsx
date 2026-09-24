import {Button, Select, Slider, Switch, TextField} from "@radix-ui/themes";
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
            size="1"
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
            size="1"
            min={schema.min}
            max={schema.max}
            step={schema.step}
            value={[draft]}
            disabled={disabled}
            onValueChange={([next]) => setDraft(next ?? 0)}
            onValueCommit={([next]) => {
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
        <div style={{display: "flex", flexDirection: "column", gap: 2}}>
            {order.map((key, index) => (
                <span key={key} style={{display: "flex", alignItems: "center", gap: 4}}>
                    <Button size="1" variant="soft" disabled={disabled || index === 0} onClick={() => move(index, -1)}>
                        ↑
                    </Button>
                    <Button size="1" variant="soft" disabled={disabled || index === order.length - 1} onClick={() => move(index, 1)}>
                        ↓
                    </Button>
                    {schema.items[key] ?? key}
                </span>
            ))}
        </div>
    );
};

export const SettingItem = ({schema, value, disabled, onChange}: SettingItemProps) => {
    const changed = value !== schema.default;

    return (
        <div className="refresher-setting-row" data-changed={changed || undefined}>
            <div className="refresher-setting-text">
                <div className="refresher-module-name">{schema.name}</div>
                <div className="refresher-module-desc">{schema.desc}</div>
                <div className="refresher-setting-default">(기본 값 : {formatDefault(schema)})</div>
            </div>

            <div className="refresher-setting-control">
                {schema.type === "check" && (
                    <Switch size="1" checked={Boolean(value)} disabled={disabled} onCheckedChange={(checked) => onChange(checked)} />
                )}
                {schema.type === "option" && (
                    <Select.Root
                        size="1"
                        value={String(value)}
                        disabled={disabled}
                        onValueChange={(selected) => onChange(selected)}
                    >
                        <Select.Trigger />
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
            </div>
        </div>
    );
};
