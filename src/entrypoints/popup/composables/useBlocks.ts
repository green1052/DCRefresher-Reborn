import {BLOCK_TYPES, blockModeStorage, blockStorage} from "@/storage/wxtStorage";
import {
    BLOCK_DETECT_MODE_TYPE_NAMES,
    TYPE_NAMES as BLOCK_TYPE_NAMES,
    normalizeBlockList,
    normalizeBlockMode
} from "@/core/block";
import {onMounted, reactive, ref} from "vue";
import {copyToClipboard, parseImportData} from "../utils/io";

export function useBlocks() {
    const blocks = reactive<{ [key in RefresherBlockType]: RefresherBlockValue[] }>({
        NICK: [],
        ID: [],
        IP: [],
        TITLE: [],
        TEXT: [],
        COMMENT: [],
        DCCON: [],
        TAB: []
    });
    const blockModes = ref<Partial<Record<RefresherBlockType, RefresherBlockDetectMode>>>({});

    const showBlockDialog = ref(false);
    const currentBlockType = ref<RefresherBlockType>("NICK");
    const blockFormData = reactive<{
        content: string;
        isRegex: boolean;
        gallery: string;
        mode: RefresherBlockDetectMode | "NONE";
    }>({
        content: "",
        isRegex: false,
        gallery: "",
        mode: "NONE"
    });

    onMounted(async () => {
        await Promise.all(
            BLOCK_TYPES.map(async (type) => {
                const [storedBlocks, storedMode] = await Promise.all([
                    blockStorage[type].getValue(),
                    blockModeStorage[type].getValue()
                ]);

                blocks[type] = normalizeBlockList(storedBlocks);
                blockModes.value[type] = normalizeBlockMode(storedMode, "SAME");

                blockStorage[type].watch((newValue) => {
                    blocks[type] = normalizeBlockList(newValue);
                });
                blockModeStorage[type].watch((newValue) => {
                    blockModes.value[type] = normalizeBlockMode(newValue, "SAME");
                });
            })
        );
    });

    const closeBlockDialog = () => {
        showBlockDialog.value = false;
    };

    const openBlockDialog = (type: RefresherBlockType) => {
        currentBlockType.value = type;
        blockFormData.content = "";
        blockFormData.isRegex = false;
        blockFormData.gallery = "";
        blockFormData.mode = "NONE";
        showBlockDialog.value = true;
    };

    const confirmAddBlock = async () => {
        if (!blockFormData.content.trim()) {
            alert(`${BLOCK_TYPE_NAMES[currentBlockType.value]} 값을 입력해주세요.`);
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
        blocks[currentBlockType.value] = blocks[currentBlockType.value].filter(
            (v) => v.content !== blockFormData.content.trim()
        );

        blocks[currentBlockType.value].push({
            content: blockFormData.content.trim(),
            isRegex: blockFormData.isRegex,
            extra: extra.length ? extra.join(" ") : undefined,
            gallery: blockFormData.gallery.trim() || undefined,
            mode: blockFormData.mode === "NONE" ? undefined : blockFormData.mode
        });

        await blockStorage[currentBlockType.value].setValue([...blocks[currentBlockType.value]]);
        closeBlockDialog();
    };

    const removeBlockedUser = async (key: RefresherBlockType, index: number) => {
        blocks[key].splice(index, 1);
        await blockStorage[key].setValue([...blocks[key]]);
    };

    const removeAllBlockedUser = async (key: RefresherBlockType) => {
        if (!confirm(`${BLOCK_TYPE_NAMES[key]} 차단 목록을 모두 삭제할까요?`)) return;
        blocks[key] = [];
        await blockStorage[key].setValue([]);
    };

    const editBlockedUser = async (key: RefresherBlockType, index: number) => {
        if (key === "DCCON") {
            alert("디시콘 수정은 아직 지원하지 않습니다, 우클릭 메뉴를 이용해주세요.");
            return;
        }

        const result = prompt(`바꿀 ${BLOCK_TYPE_NAMES[key]} 값을 입력하세요.`);

        if (!result) return;

        blocks[key][index].content = result;
        await blockStorage[key].setValue([...blocks[key]]);
    };

    const editBlockMode = async () => {
        for (const type of BLOCK_TYPES) {
            const mode = blockModes.value[type];
            if (mode) await blockModeStorage[type].setValue(mode);
        }
    };

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

            blocks[type] = target;

            for (const block of normalizeBlockList(value)) {
                if (
                    target.some((v) => v.content === block.content) &&
                    !confirm(`${block.content}가 이미 존재합니다. 추가하시겠습니까?`)
                ) {
                    continue;
                }

                target.push(block);
            }

            await blockStorage[type].setValue(target);
        }

        alert("가져오기에 성공했습니다.");
    };

    return {
        blocks,
        blockModes,
        blockKeyNames: BLOCK_TYPE_NAMES,
        blockDetectModeTypeNames: BLOCK_DETECT_MODE_TYPE_NAMES,
        blockTypes: BLOCK_TYPES,
        showBlockDialog,
        currentBlockType,
        blockFormData,
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
