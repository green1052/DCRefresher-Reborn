import React, {PointerEvent, useCallback, useState} from "react";

export function Checkbox({onChange, module, id, checked, disabled}: {
    onChange: (module: string, key: string, value: unknown) => void;
    module: string;
    id: string;
    checked: boolean;
    disabled: boolean;
}) {
    const [on, setOn] = useState(checked);
    const [down, setDown] = useState(false);
    const [translateX, setTranslateX] = useState<number | null>(null);
    const [onceOut, setOnceOut] = useState(false);

    const onToggle = useCallback(() => {
        if (disabled) return;

        if (onceOut) {
            setOnceOut(false);
            return;
        }

        onChange(module, id, !on);
        setOn(!on);
    }, [on, onceOut]);

    const onDown = useCallback(() => {
        if (disabled) return;
        setDown(true);
    }, [down]);

    const onHover = useCallback((ev: PointerEvent<HTMLDivElement>) => {
        if (disabled || !down) return;
        setTranslateX(Math.ceil(ev.nativeEvent.offsetX));
    }, [down, translateX]);

    const onOut = useCallback(() => {
        if (disabled || !down) return;

        setDown(false);
        setTranslateX(null);
        setOnceOut(true);
        onToggle();
    }, [down, translateX, onceOut]);

    const onUp = useCallback(() => {
        if (disabled) return;
        setDown(false);
        setTranslateX(null);
    }, [down, translateX]);

    return (
        <div
            className={`refresher-checkbox ${disabled ? "disabled" : ""}`}
            onClick={onToggle}
            data-on={on}
        >
            <div
                className="selected"
                style={{transform: `translateX(${translateX ?? on ? 18 : 0}px)`}}
                onPointerDown={onDown}
                onPointerMove={onHover}
                onPointerOut={onOut}
                onPointerUp={onUp}
            />
        </div>
    );
}