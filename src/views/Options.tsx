import React, {ChangeEvent, useCallback, useState} from "react";

export function Options({onChange, module, id, options, value, disabled}: {
    onChange: (module: string, key: string, value: unknown) => void;
    module: string;
    id: string;
    options: Record<string, string>
    value: string;
    disabled: boolean;
}) {
    const [selectedItem, setSelectedItem] = useState(value);

    const onInput = useCallback((ev: ChangeEvent<HTMLSelectElement>) => {
        setSelectedItem(ev.target.value);
        onChange(module, id, ev.target.value);
    }, [selectedItem]);

    return (
        <select
            className="refresher-options"
            disabled={disabled}
            onChange={onInput}
            defaultValue={selectedItem}
        >
            {Object.entries(options).map(([value2, key]) => (
                <option value={value2}>
                    {key}
                </option>
            ))}
        </select>
    );
}