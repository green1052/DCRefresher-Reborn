import {useCallback, useId, useState} from "react";

import {pinDefaultMode} from "@/core/settings-transfer";
import {BLOCK_TYPES, DETECT_MODE_NAMES, TYPE_NAMES} from "@/core/storage/items";
import type {BlockEntry, BlockType} from "@/core/storage/types";
import {type BlockInputFields, blockKey, composeExtra, normalizeBlockList, normalizeDefaults} from "@/core/block-list";
import {blockLabel, useBlocksStore} from "@/stores/blocks";
import {SAVE_FAILED} from "@/utils/error";

import {BlockDialog, DETECT_MODE_DESCRIPTIONS} from "./BlockDialog";

import {ListRow, ListTabs} from "../lists/ListTabs";
import {notify} from "../optionsStore";
import {RefresherSelect} from "../shared/RefresherSelect";

// 묶음 정규식("^(a|b...)$")이면 첫 코드의 이미지를 쓴다 - escape의 \xhh는 되돌린다.
export const dcconImage = (entry: BlockEntry): string => {
    const first = entry.isRegex ? entry.content.match(/^\^\(((?:\\x[0-9a-f]{2})?\w+)[|)]/)?.[1] : undefined;
    const code = first?.replace(/^\\x([0-9a-f]{2})/, (_, hex: string) => String.fromCharCode(parseInt(hex, 16))) ?? entry.content;
    return `https://image.dcinside.com/dccon.php?no=${code}`;
};

const entryInfo = (entry: BlockEntry): string => [composeExtra(entry), entry.extra].filter(Boolean).join(", ") || "-";

export function BlockTab() {
    const entries = useBlocksStore((state) => state.entries);
    const defaults = useBlocksStore((state) => state.defaults);
    const addEntry = useBlocksStore((state) => state.addEntry);
    const updateEntry = useBlocksStore((state) => state.updateEntry);
    const updateEntries = useBlocksStore((state) => state.updateEntries);
    const setDefault = useBlocksStore((state) => state.setDefault);
    const addEntries = useBlocksStore((state) => state.addEntries);

    // ListTabs의 걸르기 메모는 이 넷의 참조가 바뀔 때만 다시 한다 (인라인이면 다른 다시 그림에도 수천 항목을 다시 훑는다).
    const items = useCallback((type: BlockType): readonly BlockEntry[] => entries[type], [entries]);
    const searchText = useCallback((entry: BlockEntry): (string | undefined)[] => [entry.content, entry.gallery, entry.extra], []);
    const galleryOf = useCallback((entry: BlockEntry): string | undefined => entry.gallery, []);

    const [dialog, setDialog] = useState<{ type: BlockType; initial: BlockEntry | null } | null>(null);
    const modeDescId = useId();

    const importBlocks = async (parsed: Record<string, unknown>): Promise<number> => {
        // '기본값' 모드 항목은 내보낸 기기의 기본 모드로 검사됐다 - 다르면 그 모드를 적어 방식을 지킨다.
        const source = normalizeDefaults(parsed.defaults);
        let count = 0;
        for (const type of BLOCK_TYPES) {
            const list = normalizeBlockList(parsed[type]);
            if (list.length === 0) continue;
            await addEntries(type, pinDefaultMode(list, source[type], defaults[type]));
            count += list.length;
        }
        return count;
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
                fileName="dcrefresher-block"
                columns={["항목", "정보"]}
                emptyText={(type) => `차단된 ${TYPE_NAMES[type]} 없음`}
                exportData={() => ({...entries, defaults})}
                importData={importBlocks}
                onClear={(type) => updateEntries(type, () => [])}
                onAdd={(type) => setDialog({type, initial: null})}
                toolbar={(type) => (
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">기본 차단 모드</span>
                            <RefresherSelect
                                value={defaults[type]}
                                aria-label="기본 차단 모드"
                                aria-describedby={modeDescId}
                                onChange={(next) => void setDefault(type, next).catch(() => notify(SAVE_FAILED))}
                                options={DETECT_MODE_NAMES}
                            />
                        </div>
                        {/* 모드를 '기본값'으로 둔 항목이 따르는 모드라, 불일치, 불포함으로 바꾸면 그 항목들이 곧바로 허용 목록이 된다. */}
                        <p id={modeDescId} className="max-w-md text-sm text-muted-foreground">
                            모드가 '기본값'인 항목에 씁니다. {DETECT_MODE_DESCRIPTIONS[defaults[type]]}
                        </p>
                    </div>
                )}
                items={items}
                // 디시콘은 content가 코드라 이름(extra)으로도 찾을 수 있게 넣는다.
                searchText={searchText}
                galleryOf={galleryOf}
                onRemoveMany={(type, removed) => {
                    const removedIds = new Set(removed.map((entry) => entry.id));
                    return updateEntries(type, (current) => current.filter((entry) => !removedIds.has(entry.id)));
                }}
                // 같은 content+gallery는 한 항목이라, 지운 뒤 같은 것을 다시 추가했으면 되돌리기가 겹쳐 넣지 않는다.
                itemKey={blockKey}
                onRestore={updateEntries}
                row={(type, entry, remove) => (
                    <ListRow
                        key={entry.id}
                        head={type === "DCCON" ? (
                            <img src={dcconImage(entry)} alt={entry.extra || entry.content} loading="lazy" decoding="async"
                                 className="block h-10"/>
                        ) : (
                            <span className="font-medium">{entry.content}</span>
                        )}
                        label={blockLabel(type, entry)}
                        info={<span className="text-muted-foreground">{entryInfo(entry)}</span>}
                        onEdit={() => setDialog({type, initial: entry})}
                        onRemove={remove}
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
