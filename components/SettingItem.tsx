import {Switch} from "radix-ui";
import {useEffect, useState} from "react";

import {RefresherSelect} from "@/components/RefresherSelect";
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
        <input
            className="refresher-input"
            type="text"
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
        <div className="refresher-range">
            <span className="refresher-range-value">
                {draft}
                {schema.unit}
            </span>
            <input
                type="range"
                min={schema.min}
                max={schema.max}
                step={schema.step}
                value={draft}
                disabled={disabled}
                onChange={(event) => setDraft(Number(event.target.value))}
                onPointerUp={() => {
                    if (draft !== value) onChange(draft);
                }}
                onBlur={() => {
                    if (draft !== value) onChange(draft);
                }}
            />
        </div>
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
        <ul className="refresher-order">
            {order.map((key, index) => (
                <li key={key} className="refresher-order-item">
                    <span>{schema.items[key] ?? key}</span>
                    <span className="refresher-order-actions">
                        <button type="button" className="refresher-button" disabled={disabled || index === 0} onClick={() => move(index, -1)}>
                            ↑
                        </button>
                        <button
                            type="button"
                            className="refresher-button"
                            disabled={disabled || index === order.length - 1}
                            onClick={() => move(index, 1)}
                        >
                            ↓
                        </button>
                    </span>
                </li>
            ))}
        </ul>
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
                    <Switch.Root className="refresher-switch-root" checked={Boolean(value)} disabled={disabled} onCheckedChange={onChange}>
                        <Switch.Thumb className="refresher-switch-thumb" />
                    </Switch.Root>
                )}
                {schema.type === "option" && (
                    <RefresherSelect value={String(value)} disabled={disabled} onChange={onChange} options={Object.entries(schema.items)} />
                )}
                {schema.type === "text" && <TextControl {...{schema, value, disabled, onChange}} />}
                {schema.type === "range" && <RangeControl {...{schema, value, disabled, onChange}} />}
                {schema.type === "order" && <OrderControl {...{schema, value, disabled, onChange}} />}
            </div>
        </div>
    );
};
