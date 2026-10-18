import {storage} from "wxt/utils/storage";

import {BLOCK_TYPES, blockListKey} from "@/core/storage/items";
import {isRecord} from "@/utils/record";

/**
 * id 없이 저장된 차단 항목(v5에서 넘어온 목록)에 id를 붙여 저장한다. 설치·업데이트 때 한 번 부른다.
 * 저장하지 않으면 읽을 때마다 normalizeBlockList가 다른 id를 붙여 삭제·수정이 빗나가고 사용 기록이 쌓인다.
 * stores/blocks는 불러오지 않는다 — zustand의 React 바인딩이 Preact를 배경 번들에 딸려 보낸다. 항목 검사·정리는 읽는 쪽이 한다.
 */
export const fillMissingBlockIds = async (): Promise<void> => {
    for (const type of BLOCK_TYPES) {
        const stored = await storage.getItem<unknown>(blockListKey(type));
        if (!Array.isArray(stored) || stored.every((entry) => !isRecord(entry) || typeof entry.id === "string")) continue;
        await storage.setItem(blockListKey(type), stored.map((entry: unknown) =>
            isRecord(entry) && typeof entry.id !== "string" ? {...entry, id: crypto.randomUUID()} : entry));
    }
};
