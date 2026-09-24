import {Select} from "radix-ui";

interface RefresherSelectProps {
    value: string;
    options: [string, string][];
    disabled?: boolean;
    onChange: (value: string) => void;
}

export const RefresherSelect = ({value, options, disabled, onChange}: RefresherSelectProps) => (
    <Select.Root value={value || "__none__"} disabled={disabled} onValueChange={(next) => onChange(next === "__none__" ? "" : next)}>
        <Select.Trigger className="refresher-select">
            <Select.Value />
            <Select.Icon>▾</Select.Icon>
        </Select.Trigger>
        <Select.Portal>
            <Select.Content className="refresher-select-content" position="popper" sideOffset={4}>
                <Select.Viewport>
                    {options.map(([key, label]) => (
                        <Select.Item key={key} className="refresher-select-item" value={key || "__none__"}>
                            <Select.ItemText>{label}</Select.ItemText>
                            <Select.ItemIndicator>✓</Select.ItemIndicator>
                        </Select.Item>
                    ))}
                </Select.Viewport>
            </Select.Content>
        </Select.Portal>
    </Select.Root>
);
