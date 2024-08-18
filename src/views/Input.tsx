import React, {ChangeEvent, useCallback, useState} from "react";

export function Input({onChange, placeholder, module, id, value, disabled}: {
    onChange(module: string, key: string, value: unknown): void;
    placeholder: string;
    module: string;
    id: string;
    value: string;
    disabled: boolean;
}) {
    const [inputValue, setInputValue] = useState(value);

    const onInput = useCallback((ev: ChangeEvent<HTMLInputElement>) => {
        setInputValue(ev.target.value);
        onChange(module, id, ev.target.value);
    }, [inputValue]);

    return (
        <div className="refresher-input">
            <input
                onChange={onInput}
                type="text"
                placeholder={placeholder}
                value={inputValue}
                disabled={disabled}
            />
        </div>
    );
}