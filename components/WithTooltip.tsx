import type {ComponentProps, ReactElement, ReactNode} from "react";

import {Tooltip, TooltipContent, TooltipTrigger} from "@/components/ui/tooltip";

/**
 * 툴팁을 단 요소. trigger는 툴팁을 여는 요소(주로 Button)이고, 그 안의 내용(아이콘 등)은 children으로 준다.
 * 줄마다 그리는 목록(차단 목록 줄·댓글)에는 쓰지 않는다. 수천 개를 그리면 느려지므로 브라우저 기본(title)을 쓴다.
 */
export const WithTooltip = ({tip, side, trigger, children}: {
    tip: ReactNode;
    side?: ComponentProps<typeof TooltipContent>["side"];
    trigger: ReactElement;
    children: ReactNode;
}) => (
    <Tooltip>
        <TooltipTrigger render={trigger}>{children}</TooltipTrigger>
        <TooltipContent side={side}>{tip}</TooltipContent>
    </Tooltip>
);
