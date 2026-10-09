import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";

interface RefresherSelectProps<T extends string> {
    value: T;
    /** 값 → 표시 이름. 넣은 순서대로 보인다. */
    options: Record<T, string>;
    disabled?: boolean;
    /** 스크린 리더용 이름. 옆에 둔 글자는 label로 연결되지 않으므로 따로 넘긴다. */
    "aria-label"?: string;
    "aria-describedby"?: string;
    onChange: (value: T) => void;
}

/** 빈 문자열 값(기본값) 대신 쓰는 값. Base UI Select는 빈 문자열을 '고르지 않음'으로 보고 자리표시자처럼 흐리게 그린다. */
const NONE = "__none__";

/** 값 → 이름 목록으로 그리는 선택 칸. 빈 문자열(기본값)도 값으로 쓸 수 있다. */
export const RefresherSelect = <T extends string>({value, options, disabled, onChange, ...aria}: RefresherSelectProps<T>) => (
    <Select
        value={value || NONE}
        items={Object.fromEntries(Object.entries<string>(options).map(([key, label]) => [key || NONE, label]))}
        disabled={disabled}
        // 받은 값을 options의 키에서 찾아 넘긴다. 목록이 바뀌어 지금 값이 빠지면 null이 오는데, 어느 키와도 맞지 않아 무시된다.
        onValueChange={(next) => {
            for (const key in options) {
                if ((key || NONE) === next) onChange(key);
            }
        }}
    >
        <SelectTrigger {...aria} className="min-w-[140px]">
            <SelectValue/>
        </SelectTrigger>
        <SelectContent>
            {Object.entries<string>(options).map(([key, label]) => (
                <SelectItem key={key} value={key || NONE}>
                    {label}
                </SelectItem>
            ))}
        </SelectContent>
    </Select>
);
