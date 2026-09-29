import {Flex, Text} from "@radix-ui/themes";
import {useState} from "react";

import {BlockDialog} from "@/components/BlockDialog";
import {RefresherSelect} from "@/components/RefresherSelect";
import {BLOCK_TYPES, DETECT_MODE_NAMES, TYPE_NAMES} from "@/core/storage/items";
import type {BlockEntry, BlockType} from "@/core/storage/types";
import {type BlockInputFields, composeExtra, normalizeBlockList, normalizeDefaults, useBlocksStore} from "@/stores/blocks";
import {SAVE_FAILED} from "@/utils/error";
import {isRecord} from "@/utils/record";

import {ListRow, ListTabs} from "./Layout";
import {notify} from "./optionsStore";

/** 디시콘 이미지 주소. 묶음 정규식("^(a|b…)$", 하나뿐이면 "^(code)$")이면 첫 코드의 이미지를 쓴다 */
const dcconImage = (entry: BlockEntry): string => {
    const code = entry.isRegex ? (entry.content.match(/^\^\((\w+)[|)]/)?.[1] ?? entry.content) : entry.content;
    return `https://image.dcinside.com/dccon.php?no=${code}`;
};

/** 정보 칸 텍스트. 필드로 만든 플래그와 별명(extra)을 이어 붙인다 */
const entryInfo = (entry: BlockEntry): string => [composeExtra(entry), entry.extra].filter(Boolean).join(" · ") || "—";

export function BlockTab() {
    const entries = useBlocksStore((state) => state.entries);
    const defaults = useBlocksStore((state) => state.defaults);
    const addEntry = useBlocksStore((state) => state.addEntry);
    const updateEntry = useBlocksStore((state) => state.updateEntry);
    const removeEntry = useBlocksStore((state) => state.removeEntry);
    const clearType = useBlocksStore((state) => state.clearType);
    const setDefault = useBlocksStore((state) => state.setDefault);
    const addEntries = useBlocksStore((state) => state.addEntries);

    const [dialog, setDialog] = useState<{ type: BlockType; initial: BlockEntry | null } | null>(null);

    const importBlocks = async (parsed: Record<string, unknown>): Promise<number> => {
        // 차단 목록이 하나도 없으면(0 반환) 메모/설정 등 다른 데이터를 붙여넣은 것이다
        const types = BLOCK_TYPES.filter((type) => Array.isArray(parsed[type]));
        // 모드가 '기본값'인 항목은 내보낸 기기의 기본 모드로 검사됐다. 이 기기와 다르면 그 모드를 적어 검사 방식을 지킨다 (데이터 탭 가져오기와 같다).
        // 기본 모드가 없는 옛 내보내기(v5, 6.0.0~6.0.2)는 내보낸 기기의 기본을 알 수 없으므로 고정하지 않고 이 기기 기본을 따른다
        const source = isRecord(parsed.defaults) ? normalizeDefaults(parsed.defaults) : defaults;
        // 기존 목록에 덧붙인다. 같은 content+gallery는 가져온 항목으로 바꿔 뒤로 보내고, id는 새로 준다
        for (const type of types) {
            const list = normalizeBlockList(parsed[type]);
            const pinned = source[type] === defaults[type] ? undefined : source[type];
            await addEntries(type, pinned ? list.map((entry) => (entry.mode ? entry : {...entry, mode: pinned})) : list);
        }
        return types.length;
    };

    const handleSubmit = async (fields: BlockInputFields): Promise<void> => {
        if (!dialog) return;

        if (dialog.initial) await updateEntry(dialog.type, dialog.initial.id, fields);
        else await addEntry(dialog.type, fields);

        setDialog(null);
    };

    return (
        <>
            <ListTabs
                types={BLOCK_TYPES}
                names={TYPE_NAMES}
                label="차단 목록"
                columns={["항목", "정보"]}
                emptyText={(type) => `차단된 ${TYPE_NAMES[type]} 없음`}
                exportData={() => ({...entries, defaults})}
                importData={importBlocks}
                onClear={clearType}
                onAdd={(type) => setDialog({type, initial: null})}
                toolbar={(type) => (
                    <Flex align="center" gap="2">
                        <Text size="2" color="gray">기본 차단 모드</Text>
                        <RefresherSelect
                            value={defaults[type]}
                            aria-label="기본 차단 모드"
                            onChange={(next) => void setDefault(type, next).catch(() => notify(SAVE_FAILED))}
                            options={DETECT_MODE_NAMES}
                        />
                    </Flex>
                )}
                items={(type) => entries[type]}
                // 디시콘은 content가 코드라 이름(extra)으로도 찾을 수 있게 넣는다
                searchText={(entry) => [entry.content, entry.gallery, entry.extra]}
                row={(type, entry) => (
                    <ListRow
                        key={entry.id}
                        head={type === "DCCON" ? (
                            <img src={dcconImage(entry)} alt={entry.extra ?? entry.content} loading="lazy" decoding="async"
                                 style={{display: "block", height: 40}}/>
                        ) : (
                            <Text weight="medium">{entry.content}</Text>
                        )}
                        info={<Text size="2" color="gray">{entryInfo(entry)}</Text>}
                        onEdit={() => setDialog({type, initial: entry})}
                        onRemove={() => void removeEntry(type, entry.id).catch(() => notify(SAVE_FAILED))}
                    />
                )}
            />

            {dialog && (
                <BlockDialog
                    type={dialog.type}
                    initial={dialog.initial}
                    onClose={() => setDialog(null)}
                    onSubmit={handleSubmit}
                />
            )}
        </>
    );
}
