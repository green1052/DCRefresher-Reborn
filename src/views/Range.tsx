import React, {ChangeEvent, useCallback, useState} from "react";

export function Range({onChange, module, id, placeholder, value, max, min, step, unit, disabled}: {
    onChange: (module: string, key: string, value: unknown) => void;
    module: string;
    id: string;
    placeholder: string;
    value: number;
    max: number;
    min: number;
    step: number;
    unit: string;
    disabled: boolean;
}) {
    const [rangeValue, setRangeValue] = useState(value);

    const onUpdate = useCallback((ev: ChangeEvent<HTMLInputElement>) => {
        setRangeValue(Number(ev.target.value));
        onChange(module, id, Number(ev.target.value));
    }, [rangeValue]);

    return (
        <div className="refresher-range">
            <input
                type="range"
                max={max}
                min={min}
                placeholder={placeholder}
                step={step}
                disabled={disabled}
                value={rangeValue}
                onChange={onUpdate}
            />
            <span className="indicator">{rangeValue}{unit}</span>
        </div>
    );
}