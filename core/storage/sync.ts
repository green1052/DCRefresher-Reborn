import {storage, type StorageItemKey} from "wxt/utils/storage";

import {onBfcacheRestore} from "@/utils/dom";
import {once} from "@/utils/once";

/**
 * storage.watch를 signal이 끝날 때 푼다. 파이어폭스에서 스크립트가 다시 주입되면 죽은 인스턴스가 남아 감시 콜백을 계속 받으므로
 * 콘텐츠 스크립트 쪽 감시는 컨텍스트의 signal에 묶는다. 돌려준 함수로 먼저 풀 수도 있다
 */
export const watchStorage = <T>(key: StorageItemKey, callback: (next: T | null, previous: T | null) => void, signal?: AbortSignal): (() => void) => {
    const unwatch = storage.watch<T>(key, callback);
    const dispose = (): void => {
        // 확장이 무효화된 뒤에는 storage.onChanged.removeListener가 던지고, 리스너도 이미 죽었다
        if (browser.runtime?.id) unwatch();
    };
    signal?.addEventListener("abort", dispose, {once: true});
    return dispose;
};

/**
 * 저장소 키 여러 개를 한 번의 storage.local.get으로 읽어 apply에 넘기고, 바뀌면(다른 탭·옵션 페이지·이 탭의 쓰기) 다시 넘긴다.
 * 항목(defineItem)은 만드는 순간 키마다 한 번 더 읽으므로 키로 읽고 감시한다 (items.ts). 값이 없으면 null이다.
 * - load: 다시 읽기 (저장 실패 뒤 되돌리기 등)
 * - start: 읽고 감시를 건다. 여러 번 불러도 한 번만 한다. 옛 값으로 쓰면 다른 탭의 변경을 덮으므로 bfcache에서 돌아오면 다시 읽는다.
 *   signal(콘텐츠 스크립트 컨텍스트의 것)이 끝나면 감시를 푼다
 */
export const storageSync = <K extends StorageItemKey>(keys: readonly K[], apply: (key: K, value: unknown) => void) => {
    const load = async (): Promise<void> => {
        const items = await storage.getItems([...keys]);
        for (const [index, key] of keys.entries()) apply(key, items[index]?.value ?? null);
    };

    const start = once(async (signal?: AbortSignal): Promise<void> => {
        // 다 읽은 뒤에 감시를 건다. 읽기가 실패하면 once가 다음 호출에 다시 시도하는데, 그때 감시가 두 번 걸리지 않는다
        await load();
        for (const key of keys) watchStorage(key, (next) => apply(key, next), signal);
        onBfcacheRestore(load, signal);
    });

    return {load, start};
};
