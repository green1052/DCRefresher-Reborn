import {useState} from "react";

import {pinDefaultMode} from "@/core/settings-transfer";
import {BLOCK_TYPES, DETECT_MODE_NAMES, TYPE_NAMES} from "@/core/storage/items";
import type {BlockEntry, BlockType} from "@/core/storage/types";
import {type BlockInputFields, composeExtra, normalizeBlockList, normalizeDefaults, useBlocksStore} from "@/stores/blocks";
import {SAVE_FAILED} from "@/utils/error";

import {BlockDialog} from "./BlockDialog";
import {useUsage} from "./Layout";
import {ListRow, ListTabs} from "./ListTabs";
import {notify} from "./optionsStore";
import {RefresherSelect} from "./RefresherSelect";

/**
 * 디시콘 이미지 주소. 묶음 정규식("^(a|b…)$", 하나뿐이면 "^(code)$")이면 첫 코드의 이미지를 쓴다.
 * 묶을 때 쓴 RegExp.escape는 첫 글자가 영문·숫자면 "\x36…"처럼 바꾸므로 되돌린다.
 */
const dcconImage = (entry: BlockEntry): string => {
    const first = entry.isRegex ? entry.content.match(/^\^\(((?:\\x[0-9a-f]{2})?\w+)[|)]/)?.[1] : undefined;
    const code = first?.replace(/^\\x([0-9a-f]{2})/, (_, hex: string) => String.fromCharCode(parseInt(hex, 16))) ?? entry.content;
    return `https://image.dcinside.com/dccon.php?no=${code}`;
};

/** 정보 칸 텍스트. 필드로 만든 플래그와 별명(extra)을 이어 붙인다. */
const entryInfo = (entry: BlockEntry): string => [composeExtra(entry), entry.extra].filter(Boolean).join(" · ") || "—";

export function BlockTab() {
    const entries = useBlocksStore((state) => state.entries);
    const defaults = useBlocksStore((state) => state.defaults);
    const addEntry = useBlocksStore((state) => state.addEntry);
    const updateEntry = useBlocksStore((state) => state.updateEntry);
    const removeEntry = useBlocksStore((state) => state.removeEntry);
    const setEntries = useBlocksStore((state) => state.setEntries);
    const updateEntries = useBlocksStore((state) => state.updateEntries);
    const setDefault = useBlocksStore((state) => state.setDefault);
    const addEntries = useBlocksStore((state) => state.addEntries);

    const ids = BLOCK_TYPES.flatMap((type) => entries[type].map((entry) => entry.id));
    const used = useUsage("block", ids);

    const [dialog, setDialog] = useState<{ type: BlockType; initial: BlockEntry | null } | null>(null);

    const importBlocks = async (parsed: Record<string, unknown>): Promise<number> => {
        // 차단 목록이 하나도 없으면(0 반환) 메모/설정 등 다른 데이터를 붙여넣은 것이다.
        const types = BLOCK_TYPES.filter((type) => Array.isArray(parsed[type]));
        // 모드가 '기본값'인 항목은 내보낸 기기의 기본 모드로 검사됐다. 이 기기와 다르면 그 모드를 적어 검사 방식을 지킨다 (데이터 탭 가져오기와 같다).
        // JSON에 기본 모드가 없으면 내보낸 기기가 기본값을 쓴 것으로 본다.
        const source = normalizeDefaults(parsed.defaults);
        // 기존 목록에 덧붙인다. 같은 content+gallery는 가져온 항목으로 바꿔 뒤로 보내고, id는 새로 준다.
        for (const type of types) {
            await addEntries(type, pinDefaultMode(normalizeBlockList(parsed[type]), source[type], defaults[type]));
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
                onClear={(type) => setEntries(type, [])}
                onAdd={(type) => setDialog({type, initial: null})}
                toolbar={(type) => (
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">기본 차단 모드</span>
                        <RefresherSelect
                            value={defaults[type]}
                            aria-label="기본 차단 모드"
                            onChange={(next) => void setDefault(type, next).catch(() => notify(SAVE_FAILED))}
                            options={DETECT_MODE_NAMES}
                        />
                    </div>
                )}
                items={(type) => entries[type]}
                // 디시콘은 content가 코드라 이름(extra)으로도 찾을 수 있게 넣는다.
                searchText={(entry) => [entry.content, entry.gallery, entry.extra]}
                galleryOf={(entry) => entry.gallery}
                usedAt={(_type, entry) => used[entry.id]}
                onRemoveMany={(type, removed) => {
                    const removedIds = new Set(removed.map((entry) => entry.id));
                    return updateEntries(type, (current) => current.filter((entry) => !removedIds.has(entry.id)));
                }}
                row={(type, entry) => (
                    <ListRow
                        key={entry.id}
                        head={type === "DCCON" ? (
                            <img src={dcconImage(entry)} alt={entry.extra ?? entry.content} loading="lazy" decoding="async"
                                 className="block h-10"/>
                        ) : (
                            <span className="font-medium">{entry.content}</span>
                        )}
                        label={type === "DCCON" ? (entry.extra ?? entry.content) : entry.content}
                        info={<span className="text-muted-foreground">{entryInfo(entry)}</span>}
                        used={used[entry.id]}
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
