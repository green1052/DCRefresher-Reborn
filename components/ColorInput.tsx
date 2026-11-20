import type { ComponentProps } from "preact";

export const ColorInput = ({width = 36, height = 28, ...props}: ComponentProps<"input"> & {width?: number; height?: number}) => (
    // preact는 input을 type 기준 판별 유니언으로 나눠 전개와 동적 type을 함께 못 받는다 - 합친 값을 그 유니언으로 단언한다.
    <input {...{type: "color", ...props} as ComponentProps<"input">} className="cursor-pointer border-0 bg-transparent p-0" style={{width: `${width}px`, height: `${height}px`}}/>
);
