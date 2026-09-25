import {Flex, Text} from "@radix-ui/themes";
import {useState} from "react";

import {BlockDialog} from "@/components/BlockDialog";
import {RefresherSelect} from "@/components/RefresherSelect";
import {BLOCK_TYPES, DETECT_MODE_NAMES, TYPE_NAMES} from "@/core/storage/items";
import type {BlockEntry, BlockType, DetectMode} from "@/core/storage/types";
import {composeExtra} from "@/features/block/request";
import {type BlockInputFields, normalizeBlockList, useBlocksStore} from "@/stores/blocks";

import {ListRow, ListTabs} from "./Layout";

/** 디시콘 이미지 (묶음 정규식이면 첫 코드 — 디시콘이 하나뿐인 묶음은 "^(code)$") */
const dcconImage = (entry: BlockEntry): string => {
    const code = entry.isRegex ? (entry.content.match(/^\^\((\w+)[|)]/)?.[1] ?? entry.content) : entry.content;
    return `https://image.dcinside.com/dccon.php?no=${code}`;
};

/** 정보 칸 — 플래그는 필드에서 만들고, 예전 항목처럼 extra가 플래그 문자열이면 두 번 쓰지 않는다 */
const entryInfo = (entry: BlockEntry): string => {
    const flags = composeExtra(entry, DETECT_MODE_NAMES);
    return [flags, entry.extra !== flags ? entry.extra : null].filter(Boolean).join(" · ") || "—";
};

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
        // 차단 목록이 하나도 없으면 다른 데이터(메모/설정 내보내기)를 붙여넣은 것
        const types = BLOCK_TYPES.filter((type) => Array.isArray(parsed[type]));
        // 기존 목록에 덧붙인다 — 같은 content+gallery는 가져온 쪽으로 바꿔 뒤로 보내고, id는 새로 준다
        for (const type of types) await addEntries(type, normalizeBlockList(parsed[type]));
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
                exportData={() => entries}
                importData={importBlocks}
                onClear={clearType}
                onAdd={(type) => setDialog({type, initial: null})}
                toolbar={(type) => (
                    <Flex align="center" gap="2">
                        <Text size="2" color="gray">기본 차단 모드</Text>
                        <RefresherSelect
                            value={defaults[type]}
                            aria-label="기본 차단 모드"
                            onChange={(next) => void setDefault(type, next as DetectMode)}
                            options={Object.entries(DETECT_MODE_NAMES)}
                        />
                    </Flex>
                )}
                items={(type) => entries[type]}
                // 디시콘은 내용이 코드라 이름(extra)으로 찾는다
                searchText={(entry) => [entry.content, entry.gallery, entry.extra]}
                row={(type, entry) => (
                    <ListRow
                        key={entry.id}
                        head={type === "DCCON" ? (
                            <img src={dcconImage(entry)} alt={entry.extra ?? entry.content} style={{display: "block", height: 40}}/>
                        ) : (
                            <Text weight="medium">{entry.content}</Text>
                        )}
                        info={<Text size="2" color="gray">{entryInfo(entry)}</Text>}
                        onEdit={() => setDialog({type, initial: entry})}
                        onRemove={() => void removeEntry(type, entry.id)}
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
