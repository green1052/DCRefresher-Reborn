import {useCallback, useEffect, useState} from "react";

import "./timestamp.scss";

const s = 1000;
const m = s * 60;
const h = m * 60;
const d = h * 24;
const w = d * 7;
const y = d * 365.25;

const timeCounts = [y, w, d, h, m, s];
const timeFilters = ["년", "주", "일", "시간", "분", "초"];

interface Props {
    date: Date;
    mode?: "elapsed" | "remaining";
}

// 공유 티커 - 컴포넌트마다 setInterval을 만들지 않고 주기별로 하나만 운용
const tickers = new Map<number, { refCount: number; subscribers: Set<() => void>; timer: number }>();

function subscribeTick(interval: number, cb: () => void): () => void {
    let entry = tickers.get(interval);
    if (!entry) {
        const subscribers = new Set<() => void>();
        const timer = window.setInterval(() => {
            if (document.hidden) return;
            subscribers.forEach((f) => f());
        }, interval);
        entry = {refCount: 0, subscribers, timer};
        tickers.set(interval, entry);
    }

    entry.refCount++;
    entry.subscribers.add(cb);

    return () => {
        entry.subscribers.delete(cb);
        entry.refCount--;
        if (entry.refCount === 0) {
            window.clearInterval(entry.timer);
            tickers.delete(interval);
        }
    };
}

// 상대 시간 표시 훅 (주기 갱신, 숨김 탭 스킵)
function useRelativeTime(date: Date, mode: "elapsed" | "remaining", interval: number) {
    const [stampMode, setStampMode] = useState(false);
    const [, setTick] = useState(0);

    useEffect(() => {
        return subscribeTick(interval, () => setTick((t) => t + 1));
    }, [interval]);

    const convertTime = (target: Date): string => {
        const diff = mode === "elapsed"
            ? Date.now() - target.getTime()
            : target.getTime() - Date.now();

        const abs = Math.abs(diff);

        if (mode === "elapsed" && diff < 3000) return "방금 전";
        if (mode === "remaining" && diff < 3000) return "잠시 후";

        for (let f = 0; f < timeCounts.length; f++) {
            if (abs >= timeCounts[f]) {
                return Math.round(diff / timeCounts[f]) + timeFilters[f] + (mode === "elapsed" ? " 전" : " 후");
            }
        }

        return mode === "elapsed" ? "아주 오래 전" : "이미 삭제 됨";
    };

    const changeStamp = useCallback(() => {
        setStampMode((prev) => !prev);
    }, []);

    return {
        stampMode,
        stamp: convertTime(date),
        locale: date.toLocaleString(),
        changeStamp
    };
}

export default function Timestamp({date, mode = "elapsed"}: Props) {
    const {stampMode, stamp, locale, changeStamp} = useRelativeTime(date, mode, mode === "remaining" ? 5000 : 3000);

    return (
        <div
            className={mode === "remaining" ? "refresher-countdown" : "refresher-timestamp"}
            onClick={changeStamp}
            title={locale}
        >
            <span key={`stamp${stampMode}`}>
                {stampMode ? locale : stamp}
            </span>
        </div>
    );
}
