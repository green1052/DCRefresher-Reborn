import {Clock} from "lucide-react";

import {Badge} from "@/components/ui/badge";
import {WithTooltip} from "@/components/WithTooltip";

import {useTick} from "./TimeStamp";
import {parseDate, usePreviewStore} from "./previewStore";

const Remaining = ({expire}: { expire: Date }) => {
    // 1시간 미만이면 초까지 보여 주므로 1초마다 다시 그린다.
    useTick(1000);

    const diff = expire.getTime() - Date.now();
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);

    return (
        <WithTooltip tip="자동 삭제까지 남은 시간" trigger={<Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400"/>}>
            <Clock/>
            {/* 툴팁은 포커스로 열리지 않고 스크린 리더에도 읽히지 않으므로 의미를 숨긴 글로 붙인다. 1초마다 바뀌니 aria-live는 달지 않는다. */}
            <span className="sr-only">{diff <= 0 ? "자동 삭제 시간 " : "자동 삭제까지 "}</span>
            {diff <= 0 ? "만료됨" : h > 0 ? `${h}시간 ${m}분` : `${m}분 ${s}초`}
        </WithTooltip>
    );
};

/** 자동 삭제까지 남은 시간. 만료 시각이 있는 글에서만 Remaining을 그린다. 대부분의 글엔 없으니 1초 타이머를 돌리지 않는다. */
export const CountDown = () => {
    const expire = usePreviewStore((s) => s.post?.expire);
    const date = expire ? parseDate(expire) : undefined;
    return date && !Number.isNaN(date.getTime()) ? <Remaining expire={date}/> : null;
};
