import type {ComponentProps} from "react";

/** 색 선택칸(input[type=color])의 공통 모양 (설정·메모 다이얼로그·메모 폼). */
export const ColorInput = ({width = 36, height = 28, ...props}: ComponentProps<"input"> & {width?: number; height?: number}) => (
    <input
        type="color"
        {...props}
        style={{width, height, padding: 0, border: 0, background: "none", cursor: "pointer"}}
    />
);
