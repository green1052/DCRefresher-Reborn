import {useEffect, useState} from "react";

import "./range.scss";

interface Props {
    value?: number;
    placeholder?: string;
    max?: number;
    min?: number;
    step?: number;
    unit?: string;
    disabled?: boolean;
    onChange?: (value: number) => void;
}

export default function Range({
    value = 0,
    placeholder,
    max = 100,
    min = 0,
    step = 1,
    unit = "",
    disabled = false,
    onChange
}: Props) {
    const [currentValue, setCurrentValue] = useState(value);

    useEffect(() => {
        setCurrentValue(value);
    }, [value]);

    const handleChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
        const next = Number(ev.target.value);
        setCurrentValue(next);
        onChange?.(next);
    };

    return (
        <div className="refresher-range">
            <input
                disabled={disabled}
                max={max}
                min={min}
                onChange={handleChange}
                placeholder={placeholder}
                step={step}
                type="range"
                value={currentValue}
            />
            <span className="indicator">{`${currentValue}${unit}`}</span>
        </div>
    );
}
