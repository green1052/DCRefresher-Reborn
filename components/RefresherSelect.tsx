import {Select} from "@radix-ui/themes";

interface RefresherSelectProps {
    value: string;
    options: [string, string][];
    disabled?: boolean;
    /** 스크린 리더용 이름 — 옆에 둔 글자는 label로 이어지지 않는다 */
    "aria-label"?: string;
    onChange: (value: string) => void;
}

/** 값이 빈 문자열인 항목(기본값)을 위한 sentinel */
const NONE = "__none__";

export const RefresherSelect = ({value, options, disabled, "aria-label": ariaLabel, onChange}: RefresherSelectProps) => (
    <Select.Root
        size="2"
        value={value || NONE}
        disabled={disabled}
        onValueChange={(next) => onChange(next === NONE ? "" : next)}
    >
        <Select.Trigger aria-label={ariaLabel} style={{minWidth: 140}}/>
        <Select.Content>
            {options.map(([key, label]) => (
                <Select.Item key={key} value={key || NONE}>
                    {label}
                </Select.Item>
            ))}
        </Select.Content>
    </Select.Root>
);
