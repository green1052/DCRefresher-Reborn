interface RefresherSelectProps<T extends string> {
    value: T;
    options: Record<T, string>;
    disabled?: boolean;
    /** 옆 글자는 label로 연결되지 않으므로 반드시 따로 넘긴다. */
    "aria-label": string;
    "aria-describedby"?: string;
    onChange: (value: T) => void;
}

export const RefresherSelect = <T extends string>({value, options, disabled, onChange, ...aria}: RefresherSelectProps<T>) => (
    <select
        className="select min-w-[140px]"
        disabled={disabled}
        value={value}
        // 목록이 바뀌어 지금 값이 빠지면 브라우저가 첫 항목을 보여 주기만 하고 onChange는 오지 않는다.
        onChange={(ev) => onChange(ev.target.value as T)}
        {...aria}
    >
        {Object.entries<string>(options).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
        ))}
    </select>
);
