import {storage} from "wxt/utils/storage";

import {BLOCK_TYPES, blockListKey} from "@/core/storage/items";
import {isRecord} from "@/utils/record";

// id 없는 v5 항목에 id를 붙여 고정 - 안 하면 읽을 때마다 새 id가 붙어 삭제가 빗나간다 (React 번들 때문에 stores/blocks는 안 쓴다).
export const fillMissingBlockIds = async (): Promise<void> => {
    for (const type of BLOCK_TYPES) {
        const stored = await storage.getItem<unknown>(blockListKey(type));
        if (!Array.isArray(stored) || stored.every((entry) => !isRecord(entry) || typeof entry.id === "string")) continue;
        await storage.setItem(blockListKey(type), stored.map((entry: unknown) =>
            isRecord(entry) && typeof entry.id !== "string" ? {...entry, id: crypto.randomUUID()} : entry));
    }
};
