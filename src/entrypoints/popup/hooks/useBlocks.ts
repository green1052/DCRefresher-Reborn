import {blockModeStorage, blockStorage, BLOCK_TYPES} from "@/storage/wxtStorage";
import {
    BLOCK_DETECT_MODE_TYPE_NAMES,
    normalizeBlockList,
    TYPE_NAMES as BLOCK_TYPE_NAMES,
    watchBlockStorages
} from "@/core/block";
import {useCallback, useEffect, useState} from "react";
import {copyToClipboard, parseImportData} from "../utils/io";

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
    const [blockFormData, setBlockFormData] = useState<BlockFormData>({
        content: "",
        isRegex: false,
        gallery: "",
        mode: "NONE"
    });

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
        setBlockFormData({content: "", isRegex: false, gallery: "", mode: "NONE"});
        setShowBlockDialog(true);
    };

    const updateBlockForm = (patch: Partial<BlockFormData>) => {
        setBlockFormData((prev) => ({...prev, ...patch}));
    };

    const confirmAddBlock = async () => {
        if (!blockFormData.content.trim()) {
            alert(`${BLOCK_TYPE_NAMES[currentBlockType]} 값을 입력해주세요.`);
            return;
        }

        const extra: string[] = [];

        if (blockFormData.isRegex) {
            extra.push("[정규식]");
        }

        if (blockFormData.gallery.trim()) {
            extra.push(`[갤러리: ${blockFormData.gallery.trim()}]`);
        }

        if (blockFormData.mode && blockFormData.mode !== "NONE") {
            extra.push(`[${BLOCK_DETECT_MODE_TYPE_NAMES[blockFormData.mode]}]`);
        }

        // core block.add(removeExists)와 동일하게 같은 content는 교체
        const next = blocks[currentBlockType].filter((v) => v.content !== blockFormData.content.trim());

        next.push({
            content: blockFormData.content.trim(),
            isRegex: blockFormData.isRegex,
            extra: extra.length ? extra.join(" ") : undefined,
            gallery: blockFormData.gallery.trim() || undefined,
            mode: blockFormData.mode === "NONE" ? undefined : blockFormData.mode
        });

        setBlocks((prev) => ({...prev, [currentBlockType]: next}));
        await blockStorage[currentBlockType].setValue(next);
        closeBlockDialog();
    };

    const removeBlockedUser = async (key: RefresherBlockType, index: number) => {
        const next = blocks[key].filter((_, i) => i !== index);
        setBlocks((prev) => ({...prev, [key]: next}));
        await blockStorage[key].setValue(next);
    };

    const removeAllBlockedUser = async (key: RefresherBlockType) => {
        if (!confirm(`${BLOCK_TYPE_NAMES[key]} 차단 목록을 모두 삭제할까요?`)) return;
        setBlocks((prev) => ({...prev, [key]: []}));
        await blockStorage[key].setValue([]);
    };

    const editBlockedUser = async (key: RefresherBlockType, index: number) => {
        if (key === "DCCON") {
            alert("디시콘 수정은 아직 지원하지 않습니다, 우클릭 메뉴를 이용해주세요.");
            return;
        }

        const result = prompt(`바꿀 ${BLOCK_TYPE_NAMES[key]} 값을 입력하세요.`);

        if (!result) return;

        if (blocks[key] && blocks[key][index]) {
            const next = blocks[key].map((v, i) => (i === index ? {...v, content: result} : v));
            setBlocks((prev) => ({...prev, [key]: next}));
            await blockStorage[key].setValue(next);
        }
    };

    const editBlockMode = async () => {
        for (const type of BLOCK_TYPES) {
            const mode = blockModes[type];
            if (mode) await blockModeStorage[type].setValue(mode);
        }
    };

    const setBlockMode = useCallback((type: RefresherBlockType, mode: RefresherBlockDetectMode) => {
        setBlockModes((prev) => ({...prev, [type]: mode}));
    }, []);

    const exportBlock = () => copyToClipboard(blocks);

    const importBlock = async () => {
        const data = parseImportData(
            `예시: {"NICK":[],"ID":[],"IP":[],"TITLE":[],"TEXT":[],"COMMENT":[],"DCCON":[],"TAB":[]}`
        );
        if (!data) return;

        for (const [key, value] of Object.entries(data)) {
            if (!(BLOCK_TYPES as readonly string[]).includes(key)) continue;

            const type = key as RefresherBlockType;
            const target = normalizeBlockList(blocks[type]);
            if (!Array.isArray(value)) continue;

            for (const block of normalizeBlockList(value)) {
                if (
                    target.some((v) => v.content === block.content) &&
                    !confirm(`${block.content}가 이미 존재합니다. 추가하시겠습니까?`)
                ) {
                    continue;
                }

                target.push(block);
            }

            setBlocks((prev) => ({...prev, [type]: [...target]}));
            await blockStorage[type].setValue(target);
        }

        alert("가져오기에 성공했습니다.");
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
        blockFormData,
        updateBlockForm,
        openBlockDialog,
        closeBlockDialog,
        confirmAddBlock,
        removeBlockedUser,
        removeAllBlockedUser,
        editBlockedUser,
        editBlockMode,
        exportBlock,
        importBlock
    };
}
