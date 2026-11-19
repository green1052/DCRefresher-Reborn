import {cloneElement, type ComponentProps, type ReactElement, type ReactNode} from "react";

import {cn} from "cn";

const SIDE = {top: "", bottom: "tooltip-bottom", left: "tooltip-left", right: "tooltip-right"} as const;

// 수천 개를 그리는 목록 줄, 댓글에는 느려지므로 브라우저 기본(title)을 쓴다.
export const WithTooltip = ({tip, side = "top", trigger, children}: {
    tip: string;
    side?: keyof typeof SIDE;
    trigger: ReactElement;
    children: ReactNode;
}) => (
    <span className={cn("tooltip", SIDE[side])} data-tip={tip}>
        {cloneElement(trigger, undefined, children)}
    </span>
);

const VARIANT = {
    default: "btn-primary",
    destructive: "btn-error",
    outline: "btn-outline",
    secondary: "",
    ghost: "btn-ghost",
    link: "btn-link",
} as const;

const SIZE = {
    default: "",
    xs: "btn-xs",
    sm: "btn-sm",
    lg: "btn-lg",
    icon: "btn-square",
    "icon-xs": "btn-square btn-xs",
    "icon-sm": "btn-square btn-sm",
    "icon-lg": "btn-square btn-lg",
} as const;

export const TooltipButton = ({tip, side, variant = "default", size = "default", className, children, ...props}: Omit<ComponentProps<"button">, "children"> & {
    tip: string;
    side?: keyof typeof SIDE;
    variant?: keyof typeof VARIANT;
    size?: keyof typeof SIZE;
    children?: ReactNode;
}) => (
    <WithTooltip tip={tip} side={side} trigger={
        <button type="button" aria-label={tip} className={cn("btn", VARIANT[variant], SIZE[size], className)} {...props}/>
    }>
        {children}
    </WithTooltip>
);
