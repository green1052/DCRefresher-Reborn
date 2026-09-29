import {Select} from "@radix-ui/themes";

interface RefresherSelectProps<T extends string> {
    value: T;
    /** 값 → 표시 이름. 넣은 순서대로 보인다 */
    options: Record<T, string>;
    disabled?: boolean;
    /** 스크린 리더용 이름. 옆에 둔 글자는 label로 연결되지 않으므로 따로 넘긴다 */
    "aria-label"?: string;
    /** 설명 글의 id (설정 설명) */
    "aria-describedby"?: string;
    onChange: (value: T) => void;
}

/** 빈 문자열 값(기본값) 항목을 대신하는 sentinel. Radix Select는 빈 값을 받지 않는다 */
const NONE = "__none__";

export const RefresherSelect = <T extends string>({value, options, disabled, onChange, ...aria}: RefresherSelectProps<T>) => (
    <Select.Root
        size="2"
        value={value || NONE}
        disabled={disabled}
        // 선택지는 options의 키뿐이라 T로 단언해도 된다
        onValueChange={(next) => onChange((next === NONE ? "" : next) as T)}
    >
        <Select.Trigger {...aria} style={{minWidth: 140}}/>
        <Select.Content>
            {Object.entries<string>(options).map(([key, label]) => (
                <Select.Item key={key} value={key || NONE}>
                    {label}
                </Select.Item>
            ))}
        </Select.Content>
    </Select.Root>
);
