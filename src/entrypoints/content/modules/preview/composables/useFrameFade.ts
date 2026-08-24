import {useCallback, useEffect, useRef, useState} from "react";

// 프레임 페이드 인/아웃 전환 관리 훅
// closed 상태에 따라 body overflow 제어, fadeOutTimer 관리
export function useFrameFade(onClosed?: () => void) {
    const [fade, setFade] = useState(false);
    const [closed, setClosed] = useState(false);
    const fadeOutTimer = useRef<number | null>(null);
    const onClosedRef = useRef(onClosed);
    onClosedRef.current = onClosed;

    useEffect(() => {
        document.body.style.overflow = closed ? "" : "hidden";
        if (closed) onClosedRef.current?.();
    }, [closed]);

    const fadeIn = useCallback(() => {
        setFade(true);
        setClosed(false);
    }, []);

    const fadeOut = useCallback(() => {
        setFade(false);

        if (fadeOutTimer.current !== null) {
            window.clearTimeout(fadeOutTimer.current);
        }

        fadeOutTimer.current = window.setTimeout(() => {
            setClosed(true);
            fadeOutTimer.current = null;
        }, 251);
    }, []);

    useEffect(() => {
        return () => {
            document.body.style.overflow = "";
            if (fadeOutTimer.current !== null) {
                window.clearTimeout(fadeOutTimer.current);
                fadeOutTimer.current = null;
            }
        };
    }, []);

    return {fade, closed, fadeIn, fadeOut};
}
