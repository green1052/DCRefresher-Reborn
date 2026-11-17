import {storage, type WxtStorageItem} from "wxt/utils/storage";
import {useEffect, useState} from "react";

import {sendMessage} from "@/core/messaging/protocol";
import {USAGE_KEY} from "@/core/storage/items";
import type {UsageKind} from "@/core/usage";

/** 저장소 항목 하나의 값. 배경, 다른 탭에서 바뀌어도 따라가고, 읽기 전에는 fallback이다. */
export const useStorageItem = <T,>(item: WxtStorageItem<T, {}>): T => {
    const [value, setValue] = useState(item.fallback);

    useEffect(() => {
        // 읽기보다 변경 알림이 먼저 오면 늦게 온 읽기 결과가 새 값을 덮지 않게 한다.
        let watched = false;
        item.getValue().then((next) => {
            if (!watched) setValue(next);
        }, console.error);
        return item.watch((next) => {
            watched = true;
            setValue(next);
        });
    }, [item]);

    return value;
};

// 지운 항목 기록을 이미 정리한 종류 - 되돌리기(20초) 동안 재마운트해도 페이지당 한 번만 정리한다.
const pruned = new Set<UsageKind>();

// 마지막 사용 시각 - 목록이 바뀔 때만 ids를 새로 만들어야 저장소를 매번 안 읽는다.
export const useUsage = (kind: UsageKind, ids: readonly string[]): Record<string, number> => {
    const [times, setTimes] = useState<Record<string, number>>({});

    useEffect(() => {
        // 응답 전에 watch가 먼저 오면 그 새 값을 늦은 응답이 덮지 않게 버린다.
        let stale = false;
        sendMessage("refresher:syncUsage", {kind, ids: [...ids], prune: !pruned.has(kind)}).then((next) => {
            if (!stale) setTimes(next);
        }, console.error);
        pruned.add(kind);
        const unwatch = storage.watch<Record<UsageKind, Record<string, number>>>(USAGE_KEY, (next) => {
            stale = true;
            // USAGE_KEY에는 두 종류가 함께 들어 있어 다른 종류 이벤트도 온다 - 이 종류 값이 그대로면 상태를 둔다.
            const incoming = next?.[kind] ?? {};
            setTimes((current) => {
                const keys = Object.keys(current);
                if (keys.length === Object.keys(incoming).length && keys.every((id) => current[id] === incoming[id])) return current;
                return incoming;
            });
        });
        return () => {
            stale = true;
            unwatch();
        };
    }, [kind, ids]);

    return times;
};
