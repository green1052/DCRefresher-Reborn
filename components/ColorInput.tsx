import type {ComponentProps} from "react";

/**
 * 색 선택칸(input[type=color])의 공통 모양. 테두리·배경을 덜어내고 칸 크기만 정한다.
 * 설정(SettingItem), 메모 다이얼로그, 옵션의 메모 폼이 같은 모양을 쓴다.
 */
export const ColorInput = ({width = 36, height = 28, ...props}: ComponentProps<"input"> & {width?: number; height?: number}) => (
    <input
        type="color"
        {...props}
        style={{width, height, padding: 0, border: 0, background: "none", cursor: "pointer"}}
    />
);
