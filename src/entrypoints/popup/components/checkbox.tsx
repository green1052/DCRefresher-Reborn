import {useEffect, useRef, useState} from "react";

import "./checkbox.scss";

interface Props {
    value?: boolean;
    disabled?: boolean;
    onChange?: (value: boolean) => void;
}

export default function Checkbox({value = false, disabled = false, onChange}: Props) {
    const [isOn, setIsOn] = useState(value);
    const [isDown, setIsDown] = useState(false);
    const [translateX, setTranslateX] = useState<number | undefined>(undefined);
    const onceOut = useRef(false);

    useEffect(() => {
        setIsOn(value);
    }, [value]);

    const toggle = () => {
        if (disabled) return;

        if (onceOut.current) {
            onceOut.current = false;
            return;
        }

        setIsOn((prev) => {
            const next = !prev;
            onChange?.(next);
            return next;
        });
    };

    const handlePointerMove = (ev: React.PointerEvent) => {
        if (disabled || !isDown) return;
        setTranslateX(Math.max(0, Math.min(18, Math.ceil(ev.nativeEvent.offsetX))));
    };

    const handlePointerDown = () => {
        if (!disabled) setIsDown(true);
    };

    const handlePointerUp = () => {
        if (disabled) return;
        setIsDown(false);
        setTranslateX(undefined);
    };

    const handlePointerOut = () => {
        if (disabled || !isDown) return;
        setIsDown(false);
        setTranslateX(undefined);
        toggle();
        onceOut.current = true;
    };

    return (
        <div
            className={`refresher-checkbox${disabled ? " disabled" : ""}`}
            data-on={isOn}
            onClick={toggle}
        >
            <div
                className="selected"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerOut={handlePointerOut}
                onPointerUp={handlePointerUp}
                style={{transform: `translateX(${translateX ?? (isOn ? 18 : 0)}px)`}}
            />
        </div>
    );
}
