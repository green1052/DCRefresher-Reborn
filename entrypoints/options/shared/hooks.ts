import {storage, type WxtStorageItem} from "wxt/utils/storage";
import {useEffect, useState} from "react";

import {sendMessage} from "@/core/messaging/protocol";
import {USAGE_KEY} from "@/core/storage/items";
import type {UsageKind} from "@/core/usage";

/** 저장소 항목 하나의 값. 배경·다른 탭에서 바뀌어도 따라가고, 읽기 전에는 fallback이다. */
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

/**
 * 지운 항목의 기록을 이미 정리한 종류. 탭을 옮겨 다시 마운트돼도 삭제 알림의 되돌리기(20초)는 남으므로 페이지당 한 번만 정리한다.
 */
const pruned = new Set<UsageKind>();

/**
 * 차단 항목·메모가 이 기기에서 마지막으로 쓰인 시각 (core/usage). 목록이 바뀌면 기록을 목록에 맞추고, 콘텐츠 스크립트가 적으면 따라간다.
 * 지운 항목의 기록은 페이지를 열 때 정리하고, 그 뒤에 지운 것은 되돌리기로 되살릴 수 있게 남긴다.
 * ids는 목록이 바뀔 때만 새로 만들어야 한다 (렌더마다 새 배열이면 매번 저장소를 읽는다).
 */
export const useUsage = (kind: UsageKind, ids: readonly string[]): Record<string, number> => {
    const [times, setTimes] = useState<Record<string, number>>({});

    useEffect(() => {
        // 기록이 바뀌지 않았으면 저장소 이벤트가 오지 않으므로 응답으로 채운다. 응답을 기다리는 동안 watch가 먼저 오면
        // (배경이 저장소에 쓰고 같은 값을 돌려준다) 그 새 값을 응답이 덮지 않게 버린다.
        let stale = false;
        sendMessage("refresher:syncUsage", {kind, ids: [...ids], prune: !pruned.has(kind)}).then((next) => {
            if (!stale) setTimes(next);
        }, console.error);
        pruned.add(kind);
        const unwatch = storage.watch<Record<UsageKind, Record<string, number>>>(USAGE_KEY, (next) => {
            stale = true;
            // USAGE_KEY에는 차단·메모 두 종류가 함께 들어 있어 다른 종류가 바뀌어도 이벤트가 온다. 이 종류의 값이
            // 그대로면 상태를 그대로 두어 목록 걸르기(ListTabs)를 다시 하지 않는다.
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
