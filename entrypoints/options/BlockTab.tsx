import {useEffect, useId, useMemo, useState} from "react";

import {Button} from "@/components/ui/button";
import {IMAGE_HOST_ORIGINS} from "@/core/pages";

import {pinDefaultMode} from "@/core/settings-transfer";
import {BLOCK_TYPES, DETECT_MODE_NAMES, TYPE_NAMES} from "@/core/storage/items";
import type {BlockEntry, BlockType} from "@/core/storage/types";
import {type BlockInputFields, blockKey, composeExtra, normalizeBlockList, normalizeDefaults, useBlocksStore} from "@/stores/blocks";
import {SAVE_FAILED} from "@/utils/error";

import {BlockDialog, DETECT_MODE_DESCRIPTIONS} from "./BlockDialog";
import {useUsage} from "./Layout";
import {ListRow, ListTabs} from "./ListTabs";
import {notify} from "./optionsStore";
import {RefresherSelect} from "./RefresherSelect";

/**
 * 디시콘 이미지 주소. 묶음 정규식("^(a|b…)$", 하나뿐이면 "^(code)$")이면 첫 코드의 이미지를 쓴다.
 * 묶을 때 쓴 RegExp.escape는 첫 글자가 영문·숫자면 "\x36…"처럼 바꾸므로 되돌린다.
 */
export const dcconImage = (entry: BlockEntry): string => {
    const first = entry.isRegex ? entry.content.match(/^\^\(((?:\\x[0-9a-f]{2})?\w+)[|)]/)?.[1] : undefined;
    const code = first?.replace(/^\\x([0-9a-f]{2})/, (_, hex: string) => String.fromCharCode(parseInt(hex, 16))) ?? entry.content;
    return `https://image.dcinside.com/dccon.php?no=${code}`;
};

/**
 * 이미지 차단이 쓰는 이미지 호스트 권한이 있는지와 그 권한을 묻는 함수. 우클릭 차단이 처음 물어보지만,
 * 백업 복원·가져오기로 들어온 이미지 항목은 권한 없이는 가리지 못한다. 확인은 옵션을 열 때 한다.
 */
const useImageHostAccess = (): [granted: boolean | undefined, request: () => void] => {
    const [granted, setGranted] = useState<boolean>();
    useEffect(() => void browser.permissions.contains({origins: IMAGE_HOST_ORIGINS}).then(setGranted), []);
    const request = (): void => void browser.permissions.request({origins: IMAGE_HOST_ORIGINS}).then(setGranted).catch(console.error);
    return [granted, request];
};

/** 정보 칸 텍스트. 필드로 만든 플래그와 별명(extra)을 이어 붙인다. */
const entryInfo = (entry: BlockEntry): string => [composeExtra(entry), entry.extra].filter(Boolean).join(" · ") || "—";

export function BlockTab() {
    const entries = useBlocksStore((state) => state.entries);
    const defaults = useBlocksStore((state) => state.defaults);
    const addEntry = useBlocksStore((state) => state.addEntry);
    const updateEntry = useBlocksStore((state) => state.updateEntry);
    const updateEntries = useBlocksStore((state) => state.updateEntries);
    const setDefault = useBlocksStore((state) => state.setDefault);
    const addEntries = useBlocksStore((state) => state.addEntries);
    const [imageHostAccess, requestImageHostAccess] = useImageHostAccess();

    const ids = useMemo(() => BLOCK_TYPES.flatMap((type) => entries[type].map((entry) => entry.id)), [entries]);
    const used = useUsage("block", ids);

    const [dialog, setDialog] = useState<{ type: BlockType; initial: BlockEntry | null } | null>(null);
    const modeDescId = useId();

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
                        {/* 모드를 '기본값'으로 둔 항목이 따르는 모드라, 불일치·불포함으로 바꾸면 그 항목들이 곧바로 허용 목록이 된다. */}
                        <p id={modeDescId} className="max-w-md text-sm text-muted-foreground">
                            모드가 '기본값'인 항목에 씁니다. {DETECT_MODE_DESCRIPTIONS[defaults[type]]}
                        </p>
                        {type === "IMAGE" && imageHostAccess === false && (
                            <div className="flex items-center gap-2">
                                <p className="text-sm text-destructive">이미지 서버(dcinside.co.kr) 접근 권한이 없어 이미지를 가리지 못합니다.</p>
                                <Button variant="secondary" size="sm" onClick={requestImageHostAccess}>
                                    권한 허용
                                </Button>
                            </div>
                        )}
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
                // 같은 content+gallery는 한 항목이라, 지운 뒤 같은 것을 다시 추가했으면 되돌리기가 겹쳐 넣지 않는다.
                itemKey={blockKey}
                onRestore={updateEntries}
                row={(type, entry, remove) => (
                    <ListRow
                        key={entry.id}
                        head={type === "DCCON" ? (
                            <img src={dcconImage(entry)} alt={entry.extra || entry.content} loading="lazy" decoding="async"
                                 className="block h-10"/>
                        ) : type === "IMAGE" ? (
                            // 파일 해시(64자)는 표를 넓히므로 앞부분만 보인다. 전체는 툴팁·수정 창에서 본다.
                            <span className="block max-w-40 truncate font-mono" title={entry.content}>{entry.content}</span>
                        ) : (
                            <span className="font-medium">{entry.content}</span>
                        )}
                        label={type === "DCCON" ? (entry.extra || entry.content) : entry.content}
                        info={<span className="text-muted-foreground">{entryInfo(entry)}</span>}
                        used={used[entry.id]}
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
