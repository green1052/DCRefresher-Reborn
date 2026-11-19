import {useEffect, useState} from "preact/hooks";

/** 입력값이 조용해질 때까지 기다렸다 돌려준다 - 설정 검색처럼 칠 때마다 무거운 계산이 따라오는 곳에 쓴다. */
export function useDebounced<T>(value: T, delay = 150): T {
    const [settled, setSettled] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setSettled(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return settled;
}
