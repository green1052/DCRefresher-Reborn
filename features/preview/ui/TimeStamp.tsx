import {useEffect, useState, useSyncExternalStore} from "react";

import {parseDate} from "./previewStore";

/** 절대 시각 포매터. toLocaleString()은 부를 때마다 포매터를 새로 만들어, 댓글 수백 개를 다시 그릴 때 느리다. */
const ABSOLUTE = new Intl.DateTimeFormat(undefined, {year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric"});
const absoluteOf = (date: Date): string => (Number.isNaN(date.getTime()) ? "" : ABSOLUTE.format(date));

/** 상대 시각 단위 (큰 것부터). 5초마다 댓글 수백 개가 다시 재므로 호출마다 만들지 않는다. */
const RELATIVE_UNITS: [string, number][] = [
    ["년", 31_536_000_000],
    ["주", 604_800_000],
    ["일", 86_400_000],
    ["시간", 3_600_000],
    ["분", 60_000],
    ["초", 1000]
];

const relative = (date: Date): string => {
    const diff = Date.now() - date.getTime();
    // PC 시계가 조금 느리면 방금 단 댓글이 미래 시각이 된다. 1분 앞까지는 '방금 전'으로 보인다.
    if (Number.isNaN(diff) || diff < -60_000) return absoluteOf(date);
    if (diff < 3000) return "방금 전";

    for (const [label, ms] of RELATIVE_UNITS) {
        if (diff >= ms) return `${Math.floor(diff / ms)}${label} 전`;
    }

    return absoluteOf(date);
};

/**
 * TimeStamp들이 같이 쓰는 시계. 댓글마다 타이머를 두면 댓글 수백 개가 저마다 다시 그려진다.
 * 구독자가 있을 때만 5초마다 알리고 숨긴 탭에선 건너뛴다. useSyncExternalStore라 글자가 바뀐 것만 다시 그려진다.
 */
const clockListeners = new Set<() => void>();
let clockTimer = 0;
const subscribeClock = (listener: () => void): (() => void) => {
    clockListeners.add(listener);
    clockTimer ||= window.setInterval(() => {
        if (document.hidden) return;
        for (const notify of clockListeners) notify();
    }, 5000);

    return () => {
        clockListeners.delete(listener);
        if (clockListeners.size > 0) return;
        window.clearInterval(clockTimer);
        clockTimer = 0;
    };
};

/** ms마다 다시 그린다. 숨긴 탭에선 건너뛴다. */
export const useTick = (ms: number): void => {
    const [, force] = useState(0);

    useEffect(() => {
        const timer = window.setInterval(() => {
            if (!document.hidden) force((x) => x + 1);
        }, ms);
        return () => window.clearInterval(timer);
    }, [ms]);
};

/** 상대 시각. 누르면 절대 시각으로 바뀐다. 댓글과 글 머리의 작성 시각이 같이 쓴다. 키보드로도 누르게 버튼이다. */
export const TimeStamp = ({date, size = "1"}: { date: string; size?: "1" | "2" }) => {
    const parsed = parseDate(date);
    const [absolute, setAbsolute] = useState(false);
    const since = useSyncExternalStore(subscribeClock, () => relative(parsed));
    const full = absoluteOf(parsed);

    return (
        <button type="button" title={full} onClick={() => setAbsolute((x) => !x)}
                className={(size === "2" ? "text-sm" : "text-xs") + " cursor-pointer rounded-sm whitespace-nowrap text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"}>
            {Number.isNaN(parsed.getTime()) ? "이미 삭제됨" : absolute ? full : since}
        </button>
    );
};
