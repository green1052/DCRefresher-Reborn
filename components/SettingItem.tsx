import {Box, Button, Flex, IconButton, Kbd, Slider, Switch, Text, TextField, Tooltip} from "@radix-ui/themes";
import {ChevronDown, ChevronUp, GripVertical, Undo2} from "lucide-react";
import {useState} from "react";

import {RefresherSelect} from "@/components/RefresherSelect";
import {areEqual} from "@/core/module/settings";
import type {SettingSchema} from "@/core/module/types";
import type {SettingValue} from "@/core/storage/types";
import {pressedKey} from "@/utils/event";

interface SettingItemProps {
    schema: SettingSchema;
    value: SettingValue;
    /** 묶음 안에서 — 설명은 툴팁으로, 이름·컨트롤만 한 줄에 */
    compact?: boolean;
    /** key 설정: 같은 모듈의 다른 key 설정이 쓰는 키 — 고를 수 없다 */
    takenKeys?: string[];
    onChange: (value: SettingValue) => void;
}

type NarrowProps<T extends SettingSchema["type"]> = Omit<SettingItemProps, "schema"> & {
    schema: Extract<SettingSchema, { type: T }>
};

/** 범위 값 표시 — 저장은 ms 그대로, 보여줄 때만 초 단위로 (5000ms → 5초) */
const formatRange = (value: number, unit: string): string => (unit === "ms" ? `${value / 1000}초` : `${value}${unit}`);

const formatDefault = (schema: SettingSchema): string => {
    switch (schema.type) {
        case "check":
            return schema.default ? "사용" : "미사용";
        case "range":
            return formatRange(schema.default, schema.unit);
        case "option":
            return schema.items[schema.default] ?? schema.default;
        case "order":
            return schema.default.map((key) => schema.items[key] ?? key).join(", ");
        case "key":
            return schema.default.toUpperCase();
        default:
            return String(schema.default);
    }
};

/** 저장 전 편집값 — 저장값이 바뀌면(되돌리기·다른 탭) 따라간다. 렌더 중에 비교해 옛 값이 한 번 그려지지 않게 */
const useDraft = <T, >(value: T): [T, (next: T) => void] => {
    const [draft, setDraft] = useState(value);
    const [synced, setSynced] = useState(value);
    if (synced !== value) {
        setSynced(value);
        setDraft(value);
    }
    return [draft, setDraft];
};

/** 색 선택 — 드래그 중엔 미리보기만 바꾸고, 선택 창을 닫을 때(네이티브 change) 저장한다 */
const ColorControl = ({schema, value, compact, onChange}: NarrowProps<"color">) => {
    const [draft, setDraft] = useDraft(String(value));

    return (
        <Flex align="center" gap="2">
            {!compact && <Text size="2" color="gray" style={{fontVariantNumeric: "tabular-nums"}}>{draft}</Text>}
            <input
                type="color"
                aria-label={schema.name}
                title={draft}
                value={draft}
                onChange={(ev) => setDraft(ev.target.value)}
                // React onChange는 input 이벤트라 드래그마다 불린다 — 창을 닫을 때만 오는 change는 직접 듣는다
                ref={(element) => {
                    if (!element) return;
                    const commit = (): void => onChange(element.value);
                    element.addEventListener("change", commit);
                    return () => element.removeEventListener("change", commit);
                }}
                style={{width: 36, height: 28, padding: 0, border: 0, background: "none", cursor: "pointer"}}
            />
        </Flex>
    );
};

const TextControl = ({schema, value, onChange}: NarrowProps<"text">) => {
    const [draft, setDraft] = useDraft(String(value));

    return (
        <TextField.Root
            size="2"
            aria-label={schema.name}
            placeholder={schema.placeholder ?? String(schema.default)}
            value={draft}
            onChange={(ev) => setDraft(ev.target.value)}
            onBlur={() => {
                if (draft !== value) onChange(draft);
            }}
            onKeyDown={(ev) => ev.key === "Enter" && (ev.target as HTMLInputElement).blur()}
        />
    );
};

/** 키 하나 — 누른 뒤 원하는 키를 치면 바뀐다 (영문·숫자만, 다른 키는 취소). 다른 단축키가 쓰는 키면 알려 주고 계속 기다린다 */
const KeyControl = ({schema, value, takenKeys = [], onChange}: NarrowProps<"key">) => {
    const [listening, setListening] = useState(false);
    const [taken, setTaken] = useState("");
    // 화면 글자와 같은 내용을 읽어 준다 — 이름만 주면 '키 입력…'·'이미 사용 중'이 들리지 않는다
    const shown = taken ? `${taken.toUpperCase()}: 이미 사용 중` : listening ? "키 입력…" : String(value).toUpperCase();

    return (
        <Button size="2" variant="soft" color={taken ? "red" : listening ? undefined : "gray"} style={{minWidth: 72}}
                aria-label={`${schema.name}: ${shown}`}
                onClick={() => setListening(true)}
                onBlur={() => {
                    setListening(false);
                    setTaken("");
                }}
                onKeyDown={(ev) => {
                    if (!listening) return;
                    ev.preventDefault();

                    const key = pressedKey(ev);
                    if (/^[a-z0-9]$/.test(key) && key !== value && takenKeys.includes(key)) {
                        setTaken(key);
                        return;
                    }
                    if (/^[a-z0-9]$/.test(key)) onChange(key);
                    setListening(false);
                    setTaken("");
                }}>
            {taken || listening ? shown : <Kbd>{shown}</Kbd>}
        </Button>
    );
};

const RangeControl = ({schema, value, onChange}: NarrowProps<"range">) => {
    // 화살표 키는 한 칸마다 commit한다 — key로 다시 마운트해 맞추면 그때마다 포커스를 잃는다
    const [draft, setDraft] = useDraft(Number(value));

    // rt-SliderRoot는 width:stretch(부모 100%) — 부모 폭을 고정해야 트랙이 그려짐
    return (
        // Themes Slider는 aria-label을 role=slider인 thumb가 아니라 root에 넘긴다 — 묶음에 이름을 준다
        <Flex align="center" gap="3" role="group" aria-label={schema.name} style={{width: 240}}>
            <Slider
                size="2"
                min={schema.min}
                max={schema.max}
                step={schema.step}
                value={[draft]}
                style={{flex: 1}}
                onValueChange={(values) => {
                    const next = values[0];
                    if (next !== undefined) setDraft(next);
                }}
                onValueCommit={(values) => {
                    const next = values[0];
                    if (next !== undefined && next !== value) onChange(next);
                }}
            />
            <Text size="2" weight="bold" style={{minWidth: 56, textAlign: "right", fontVariantNumeric: "tabular-nums"}}>
                {formatRange(draft, schema.unit)}
            </Text>
        </Flex>
    );
};

const OrderControl = ({schema, value, onChange}: NarrowProps<"order">) => {
    const [dragging, setDragging] = useState<number | null>(null);
    const [over, setOver] = useState<number | null>(null);

    // 스토어가 스키마에 맞춰 둔 값 (normalizeSetting)
    const order = value as string[];

    const move = (from: number, to: number): void => {
        const next = [...order];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved!);
        onChange(next);
    };

    const drop = (to: number): void => {
        if (dragging !== null && dragging !== to) move(dragging, to);
        setDragging(null);
        setOver(null);
    };

    return (
        <Flex direction="column" gap="1" minWidth="200px">
            {order.map((key, index) => (
                <Flex
                    key={key}
                    align="center"
                    gap="2"
                    py="1"
                    pl="2"
                    pr="1"
                    style={{
                        borderRadius: "var(--radius-2)",
                        border: "1px solid var(--gray-a5)",
                        cursor: "grab",
                        opacity: dragging === index ? 0.4 : 1,
                        background: over === index && dragging !== null ? "var(--accent-a3)" : "var(--color-surface)"
                    }}
                    draggable
                    onDragStart={(ev) => {
                        // Firefox는 dataTransfer에 데이터가 없으면 드래그 시작을 안 함
                        ev.dataTransfer.setData("text/plain", String(index));
                        ev.dataTransfer.effectAllowed = "move";
                        setDragging(index);
                    }}
                    onDragEnd={() => {
                        setDragging(null);
                        setOver(null);
                    }}
                    onDragOver={(ev) => {
                        ev.preventDefault();
                        setOver(index);
                    }}
                    onDragLeave={() => setOver(null)}
                    onDrop={(ev) => {
                        ev.preventDefault();
                        drop(index);
                    }}
                >
                    <GripVertical size={14} color="var(--gray-9)"/>
                    <Text size="2" style={{flex: 1}}>
                        {schema.items[key] ?? key}
                    </Text>
                    <IconButton size="1" variant="ghost" color="gray" aria-label="위로"
                                disabled={index === 0} onClick={() => move(index, index - 1)}>
                        <ChevronUp size={14}/>
                    </IconButton>
                    <IconButton size="1" variant="ghost" color="gray" aria-label="아래로"
                                disabled={index === order.length - 1}
                                onClick={() => move(index, index + 1)}>
                        <ChevronDown size={14}/>
                    </IconButton>
                </Flex>
            ))}
        </Flex>
    );
};

export const SettingItem = ({schema, value, compact, takenKeys, onChange}: SettingItemProps) => {
    const title = (
        <Flex align="center" gap="1">
            <Text size="2" weight="medium" title={compact ? schema.desc : undefined}>
                {schema.name}
            </Text>
            {!areEqual(value, schema.default) && (
                <Tooltip content={`기본값으로 되돌리기 (${formatDefault(schema)})`}>
                    <IconButton size="1" variant="ghost" color="gray" aria-label="기본값으로 되돌리기"
                                onClick={() => onChange(structuredClone(schema.default))}>
                        <Undo2 size={14}/>
                    </IconButton>
                </Tooltip>
            )}
        </Flex>
    );

    return (
        <Flex justify="between" align="center" gap={compact ? "2" : "4"} py={compact ? "1" : "3"} wrap={compact ? "nowrap" : {initial: "wrap", sm: "nowrap"}}>
            <Box flexGrow="1" minWidth="0">
                {title}
                {!compact && (
                    <Text as="p" size="1" color="gray">
                        {schema.desc}
                    </Text>
                )}
            </Box>

            <Box flexShrink="0">
                {schema.type === "check" && (
                    <Switch size="2" aria-label={schema.name} checked={Boolean(value)}
                            onCheckedChange={(checked) => onChange(checked)}/>
                )}
                {schema.type === "option" && (
                    <RefresherSelect value={String(value)} aria-label={schema.name} options={Object.entries(schema.items)} onChange={onChange}/>
                )}
                {schema.type === "text" && <TextControl {...{schema, value, onChange}} />}
                {schema.type === "color" && <ColorControl {...{schema, value, compact, onChange}} />}
                {schema.type === "range" && <RangeControl {...{schema, value, onChange}} />}
                {schema.type === "order" && <OrderControl {...{schema, value, onChange}} />}
                {schema.type === "key" && <KeyControl {...{schema, value, takenKeys, onChange}} />}
            </Box>
        </Flex>
    );
};
