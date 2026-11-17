import type {ComponentProps, ReactElement, ReactNode} from "react";
import {Tooltip as TooltipPrimitive} from "@base-ui/react/tooltip";

import {overlay} from "@/components/overlay/shadow";
import {Button} from "@/components/ui/button";
import {Tooltip, TooltipTrigger} from "@/components/ui/tooltip";
import {cn} from "cn";

/**
 * 오버레이(shadow DOM) 안의 포털 칸에 그리는 TooltipContent. components/ui/tooltip.tsx는 순정 shadcn이라 포털 칸을 못 바꾸므로
 * Base UI 프리미티브로 직접 조립한다. 모양 문자열은 components/ui/tooltip.tsx와 맞춘다.
 * 옵션, 팝업에서는 overlay.portal이 비어 body에 그린다(순정과 같은 행동).
 */
const OverlayTooltipContent = ({className, side = "top", sideOffset = 4, align = "center", alignOffset = 0, children, ...props}:
    TooltipPrimitive.Popup.Props & Pick<TooltipPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">) => (
    <TooltipPrimitive.Portal container={overlay.portal}>
        <TooltipPrimitive.Positioner align={align} alignOffset={alignOffset} side={side} sideOffset={sideOffset} className="isolate z-50">
            <TooltipPrimitive.Popup data-slot="tooltip-content" className={cn(
                "z-50 inline-flex w-fit max-w-xs origin-(--transform-origin) items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs text-background has-data-[slot=kbd]:pr-1.5 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-sm data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
                className
            )} {...props}>
                {children}
                <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground data-[side=bottom]:top-1 data-[side=inline-end]:top-1/2! data-[side=inline-end]:-left-1 data-[side=inline-end]:-translate-y-1/2 data-[side=inline-start]:top-1/2! data-[side=inline-start]:-right-1 data-[side=inline-start]:-translate-y-1/2 data-[side=left]:top-1/2! data-[side=left]:-right-1 data-[side=left]:-translate-y-1/2 data-[side=right]:top-1/2! data-[side=right]:-left-1 data-[side=right]:-translate-y-1/2 data-[side=top]:-bottom-2.5"/>
            </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
);

/**
 * 툴팁을 단 요소. trigger는 툴팁을 여는 요소(주로 Button)이고, 그 안의 내용(아이콘 등)은 children으로 준다.
 * 줄마다 그리는 목록(차단 목록 줄, 댓글)에는 쓰지 않는다. 수천 개를 그리면 느려지므로 브라우저 기본(title)을 쓴다.
 */
export const WithTooltip = ({tip, side, trigger, children}: {
    tip: ReactNode;
    side?: ComponentProps<typeof OverlayTooltipContent>["side"];
    trigger: ReactElement;
    children: ReactNode;
}) => (
    <Tooltip>
        <TooltipTrigger render={trigger}>{children}</TooltipTrigger>
        <OverlayTooltipContent side={side}>{tip}</OverlayTooltipContent>
    </Tooltip>
);

/** 툴팁 글이 곧 이름(aria-label)인 버튼. 아이콘만 있는 버튼에 쓴다. */
export const TooltipButton = ({tip, side, children, ...props}: ComponentProps<typeof Button> & {
    tip: string;
    side?: ComponentProps<typeof OverlayTooltipContent>["side"];
}) => (
    <WithTooltip tip={tip} side={side} trigger={<Button aria-label={tip} {...props}/>}>{children}</WithTooltip>
);
