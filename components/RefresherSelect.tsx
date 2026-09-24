import {Select} from "@radix-ui/themes";

interface RefresherSelectProps {
    value: string;
    options: [string, string][];
    disabled?: boolean;
    onChange: (value: string) => void;
}

/** 값이 빈 문자열인 항목(기본값)을 위한 sentinel */
const NONE = "__none__";

export const RefresherSelect = ({value, options, disabled, onChange}: RefresherSelectProps) => (
    <Select.Root
        size="2"
        value={value || NONE}
        disabled={disabled}
        onValueChange={(next) => onChange(next === NONE ? "" : next)}
    >
        <Select.Trigger style={{minWidth: 140}} />
        <Select.Content>
            {options.map(([key, label]) => (
                <Select.Item key={key} value={key || NONE}>
                    {label}
                </Select.Item>
            ))}
        </Select.Content>
    </Select.Root>
);
