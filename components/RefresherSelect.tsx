import {Select} from "@radix-ui/themes";

interface RefresherSelectProps<T extends string> {
    value: T;
    /** 값 → 보이는 이름 (넣은 순서대로) */
    options: Record<T, string>;
    disabled?: boolean;
    /** 스크린 리더용 이름 — 옆에 둔 글자는 label로 이어지지 않는다 */
    "aria-label"?: string;
    onChange: (value: T) => void;
}

/** 값이 빈 문자열인 항목(기본값)을 위한 sentinel — Radix Select는 빈 값을 받지 않는다 */
const NONE = "__none__";

export const RefresherSelect = <T extends string>({value, options, disabled, "aria-label": ariaLabel, onChange}: RefresherSelectProps<T>) => (
    <Select.Root
        size="2"
        value={value || NONE}
        disabled={disabled}
        // 항목은 options의 키뿐이다
        onValueChange={(next) => onChange((next === NONE ? "" : next) as T)}
    >
        <Select.Trigger aria-label={ariaLabel} style={{minWidth: 140}}/>
        <Select.Content>
            {Object.entries<string>(options).map(([key, label]) => (
                <Select.Item key={key} value={key || NONE}>
                    {label}
                </Select.Item>
            ))}
        </Select.Content>
    </Select.Root>
);
