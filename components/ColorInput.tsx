import type {ComponentProps} from "react";

export const ColorInput = ({width = 36, height = 28, ...props}: ComponentProps<"input"> & {width?: number; height?: number}) => (
    <input type="color" {...props} className="cursor-pointer border-0 bg-transparent p-0" style={{width, height}}/>
);
