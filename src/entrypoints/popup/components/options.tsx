import "./options.scss";

interface Props {
    options?: Record<string, string>;
    value?: string;
    disabled?: boolean;
    onChange?: (value: string) => void;
}

export default function Options({options = {}, value = "", disabled = false, onChange}: Props) {
    const handleChange = (ev: React.ChangeEvent<HTMLSelectElement>) => {
        onChange?.(ev.target.value);
    };

    return (
        <select
            className="refresher-options"
            disabled={disabled}
            onChange={handleChange}
            value={value}
        >
            {Object.entries(options).map(([key, optionValue]) => (
                <option key={key} value={key}>
                    {optionValue}
                </option>
            ))}
        </select>
    );
}
