import {type CSSProperties, type RefObject, type TransitionEvent, useEffect, useRef, useState} from "react";

const CLOSED = {height: 0, opacity: 0} as const;

/**
 * 접기/펼치기 패널 상태. 펼칠 때는 닫힌 모습으로 그린 뒤 잰 높이만큼 넓히고,
 * 접을 때는 0으로 줄어든 뒤(motion-reduce 폴백 250ms) 자식을 언마운트한다.
 * 소비자는 패널에 transition-[height,opacity] 클래스를 붙인다.
 */
export const useCollapse = (open: boolean): {
    ref: RefObject<HTMLDivElement | null>;
    style: CSSProperties;
    onTransitionEnd: (ev: TransitionEvent<HTMLDivElement>) => void;
    render: boolean;
} => {
    const ref = useRef<HTMLDivElement>(null);
    // 펼친 뒤에는 높이를 auto로 풀어 내용이 늘어나도 잘리지 않게 한다.
    const [style, setStyle] = useState<CSSProperties>(open ? {} : CLOSED);
    const [mounted, setMounted] = useState(open);
    const render = open || mounted;

    useEffect(() => {
        const el = ref.current;
        // 닫힌 채 시작한 패널은 아직 그려지지 않았다 - 그리지 않은 채로 둔다.
        if (!el) return;
        if (open) {
            setStyle(CLOSED);
            // 두 번째 프레임에 바꿔야 닫힌 시작 프레임이 그려져 전환이 일어난다.
            const first = requestAnimationFrame(() =>
                requestAnimationFrame(() => setStyle({height: el.scrollHeight, opacity: 1})));
            return () => cancelAnimationFrame(first);
        }
        // 접히는 동안에는 그대로 둔다.
        setStyle({height: el.offsetHeight, opacity: 1});
        const first = requestAnimationFrame(() => requestAnimationFrame(() => setStyle(CLOSED)));
        // transition-reduce 환경에서는 transitionend가 오지 않는다.
        const timer = setTimeout(() => setMounted(false), 250);
        return () => {
            cancelAnimationFrame(first);
            clearTimeout(timer);
        };
    }, [open, ref]);

    return {
        ref,
        style,
        render,
        onTransitionEnd: (ev) => {
            if (ev.target !== ev.currentTarget || ev.propertyName !== "height") return;
            if (open) setStyle({}); // 높이 고정을 풀어 이후 내용 변화에 따라게 한다.
            else setMounted(false);
        }
    };
};
