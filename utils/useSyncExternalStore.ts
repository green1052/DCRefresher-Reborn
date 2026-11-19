import {useEffect, useState} from "preact/hooks";

/**
 * preact/hooks에는 없는 useSyncExternalStore. react 판과 같은 의미로 - 저장한 값과 알림에 다시 읽은 값이 다를 때만 다시 그린다.
 * 값 비교가 있으므로 관련 없는 스토어 변경이 이 컴포넌트를 다시 그리지 않고, 선택자가 새 객체를 돌려줘도 루프에 빠지지 않는다.
 * 렌더링 중 값은 다시 읽지 않는다(props에 의존하는 선택자는 스토어 알림 뒤에 갱신된다 - react와 같은 제약).
 */
export function useSyncExternalStore<T>(subscribe: (onStoreChange: () => void) => () => void, getSnapshot: () => T): T {
    const [snapshot, setSnapshot] = useState(getSnapshot);
    useEffect(() => {
        const notify = (): void => setSnapshot((previous) => {
            const next = getSnapshot();
            return Object.is(previous, next) ? previous : next;
        });
        // 렌더링과 이펙트 사이에 스토어가 바뀌었을 수 있으니 마운트 때도 한 번 재다.
        notify();
        return subscribe(notify);
    }, [subscribe]);
    return snapshot;
}
