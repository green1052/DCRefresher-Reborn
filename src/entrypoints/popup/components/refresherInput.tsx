import "./refresherInput.scss";

interface Props {
    value?: string;
    placeholder?: string;
    disabled?: boolean;
    onChange?: (value: string) => void;
    onKeyUpEnter?: () => void;
}

export default function RefresherInput({value = "", placeholder, disabled = false, onChange, onKeyUpEnter}: Props) {
    const handleChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
        onChange?.(ev.target.value);
    };

    return (
        <div className="refresher-input">
            <input
                disabled={disabled}
                onChange={handleChange}
                onKeyUp={(ev) => {
                    if (ev.key === "Enter" && onKeyUpEnter) onKeyUpEnter();
                }}
                placeholder={placeholder}
                type="text"
                value={value}
            />
        </div>
    );
}
