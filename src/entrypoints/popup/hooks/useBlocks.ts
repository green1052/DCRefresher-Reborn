import {blockModeStorage, blockStorage, BLOCK_TYPES} from "@/storage/wxtStorage";
import {
    BLOCK_DETECT_MODE_TYPE_NAMES,
    normalizeBlockList,
    TYPE_NAMES as BLOCK_TYPE_NAMES,
    watchBlockStorages
} from "@/core/block";
import {useCallback, useEffect, useState} from "react";
import {copyToClipboard, parseImportData} from "../utils/io";
import {ui} from "../../options/components/UiService";

export interface BlockFormData {
    content: string;
    isRegex: boolean;
    gallery: string;
    mode: RefresherBlockDetectMode | "NONE";
}

const EMPTY_BLOCKS: Record<RefresherBlockType, RefresherBlockValue[]> = {
    NICK: [],
    ID: [],
    IP: [],
    TITLE: [],
    TEXT: [],
    COMMENT: [],
    DCCON: [],
    TAB: []
};

export function useBlocks() {
    const [blocks, setBlocks] = useState(EMPTY_BLOCKS);
    const [blockModes, setBlockModes] = useState<Partial<Record<RefresherBlockType, RefresherBlockDetectMode>>>({});

    const [showBlockDialog, setShowBlockDialog] = useState(false);
    const [currentBlockType, setCurrentBlockType] = useState<RefresherBlockType>("NICK");

    useEffect(() => {
        return watchBlockStorages(
            (type, list) => {
                setBlocks((prev) => ({...prev, [type]: list}));
            },
            (type, mode) => {
                setBlockModes((prev) => ({...prev, [type]: mode}));
            }
        );
    }, []);

    const closeBlockDialog = () => {
        setShowBlockDialog(false);
    };

    const openBlockDialog = (type: RefresherBlockType) => {
        setCurrentBlockType(type);
        setShowBlockDialog(true);
    };

    // 팝업이 열려 있는 동안 콘텐츠 탭에서도 목록이 바뀐다. 갱신은 스토리지 최신값을 읽어
    // 계산한 뒤 반영한다(레거시 스냅샷 RMW는 동시 쓰기를 지운다). setBlocks는 팝업의 watcher가
    // setValue를 반영하기 전까지 즉시 반응용으로 유지.
    const confirmAddBlock = async (data: BlockFormData) => {
        if (!data.content.trim()) {
            ui.alert(`${BLOCK_TYPE_NAMES[currentBlockType]} 값을 입력해주세요.`);
            return;
        }

        const content = data.content.trim();
        const extra: string[] = [];

        if (data.isRegex) {
            extra.push("[정규식]");
        }

        if (data.gallery.trim()) {
            extra.push(`[갤러리: ${data.gallery.trim()}]`);
        }

        if (data.mode && data.mode !== "NONE") {
            extra.push(`[${BLOCK_DETECT_MODE_TYPE_NAMES[data.mode]}]`);
        }

        const next = normalizeBlockList(await blockStorage[currentBlockType].getValue()).filter(
            (v) => v.content !== content
        );

        next.push({
            content,
            isRegex: data.isRegex,
            extra: extra.length ? extra.join(" ") : undefined,
            gallery: data.gallery.trim() || undefined,
            mode: data.mode === "NONE" ? undefined : data.mode
        });

        setBlocks((prev) => ({...prev, [currentBlockType]: next}));
        await blockStorage[currentBlockType].setValue(next);
        closeBlockDialog();
    };

    const removeBlockedUser = async (key: RefresherBlockType, content: string) => {
        const next = normalizeBlockList(await blockStorage[key].getValue()).filter(
            (v) => v.content !== content
        );
        setBlocks((prev) => ({...prev, [key]: next}));
        await blockStorage[key].setValue(next);
    };

    const removeAllBlockedUser = async (key: RefresherBlockType) => {
        if (!(await ui.confirm(`${BLOCK_TYPE_NAMES[key]} 차단 목록을 모두 삭제할까요?`))) return;
        setBlocks((prev) => ({...prev, [key]: []}));
        await blockStorage[key].setValue([]);
    };

    const editBlockedUser = async (key: RefresherBlockType, content: string) => {
        if (key === "DCCON") {
            ui.alert("디시콘 수정은 아직 지원하지 않습니다, 우클릭 메뉴를 이용해주세요.");
            return;
        }

        const result = await ui.prompt(`바꿀 ${BLOCK_TYPE_NAMES[key]} 값을 입력하세요.`);

        if (!result) return;

        const next = normalizeBlockList(await blockStorage[key].getValue()).map((v) =>
            v.content === content ? {...v, content: result} : v
        );
        setBlocks((prev) => ({...prev, [key]: next}));
        await blockStorage[key].setValue(next);
    };

    // 바뀐 타입 하나만 저장한다. 전체 재기록은 타입 8개 키를 전부 생성해버린다.
    const setBlockMode = useCallback((type: RefresherBlockType, mode: RefresherBlockDetectMode) => {
        setBlockModes((prev) => ({...prev, [type]: mode}));
        void blockModeStorage[type].setValue(mode);
    }, []);

    const exportBlock = () => copyToClipboard(blocks);

    const importBlock = async () => {
        const data = await parseImportData(
            `예시: {"NICK":[],"ID":[],"IP":[],"TITLE":[],"TEXT":[],"COMMENT":[],"DCCON":[],"TAB":[]}`
        );
        if (!data) return;

        for (const [key, value] of Object.entries(data)) {
            if (!(BLOCK_TYPES as readonly string[]).includes(key)) continue;

            const type = key as RefresherBlockType;
            // confirm 대화상자 동안에도 다른 탭이 쓸 수 있으므로 타입마다 최신값을 읽는다.
            const target = normalizeBlockList(await blockStorage[type].getValue());
            if (!Array.isArray(value)) continue;

            for (const block of normalizeBlockList(value)) {
                if (
                    target.some((v) => v.content === block.content) &&
                    !(await ui.confirm(`${block.content}가 이미 존재합니다. 추가하시겠습니까?`))
                ) {
                    continue;
                }

                target.push(block);
            }

            setBlocks((prev) => ({...prev, [type]: [...target]}));
            await blockStorage[type].setValue(target);
        }

        ui.alert("가져오기에 성공했습니다.");
    };

    return {
        blocks,
        blockModes,
        setBlockMode,
        blockKeyNames: BLOCK_TYPE_NAMES,
        blockDetectModeTypeNames: BLOCK_DETECT_MODE_TYPE_NAMES,
        blockTypes: BLOCK_TYPES,
        showBlockDialog,
        currentBlockType,
        openBlockDialog,
        closeBlockDialog,
        confirmAddBlock,
        removeBlockedUser,
        removeAllBlockedUser,
        editBlockedUser,
        exportBlock,
        importBlock
    };
}
