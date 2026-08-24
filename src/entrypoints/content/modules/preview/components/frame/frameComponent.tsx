import {ChevronDown, ChevronUp} from "lucide-react";
import {createContext, useContext, useEffect, useRef, useState} from "react";
import type {FrameScrollApi, FrameStackOption, PreviewFrame} from "../../frame";

import Frame from "./frame";
import ScrollIndicator from "./scroll";

import "./frameComponent.scss";

// 댓글 입력 포커스 상태 공유 (write_comment가 소비)
export const InputFocusContext = createContext<{ current: boolean }>({current: false});

export const useInputFocus = () => useContext(InputFocusContext);

interface Props {
    frames: PreviewFrame[];
    option?: FrameStackOption;
    apiRef: { current: FrameScrollApi | null };
}

export default function FrameComponent({frames, option = {}, apiRef}: Props) {
    const [scrollModeTop, setScrollModeTop] = useState(false);
    const [scrollModeBottom, setScrollModeBottom] = useState(false);
    const [closed, setClosed] = useState(false);

    const groupElement = useRef<HTMLDivElement>(null as unknown as HTMLDivElement);
    const commentFrameRef = useRef<{ incrementCommentKey?: () => void } | null>(null);
    const inputFocus = useRef(false);

    // 마운트 후 바뀌지 않는 옵션이므로 반응형 불필요
    const background = option?.background ?? false;
    const blur = option?.blur ?? false;
    const onScroll = option?.onScroll;

    const closedRef = useRef(false);
    closedRef.current = closed;

    // 페이드 전환 (fade/closed, body overflow, timer 관리)
    const [fade, setFade] = useState(false);
    const fadeOutTimer = useRef<number | null>(null);

    useEffect(() => {
        document.body.style.overflow = "hidden";
        document.addEventListener("keyup", onKeyUp);
        return () => {
            document.removeEventListener("keyup", onKeyUp);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        document.body.style.overflow = closed ? "" : "hidden";
        if (closed) frames.forEach((frame) => frame.emitClose());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [closed]);

    useEffect(() => {
        return () => {
            document.body.style.overflow = "";
            if (fadeOutTimer.current !== null) {
                window.clearTimeout(fadeOutTimer.current);
                fadeOutTimer.current = null;
            }
        };
    }, []);

    const fadeIn = () => {
        setFade(true);
        setClosed(false);
    };

    const fadeOut = () => {
        setFade(false);

        if (fadeOutTimer.current !== null) {
            window.clearTimeout(fadeOutTimer.current);
        }

        fadeOutTimer.current = window.setTimeout(() => {
            setClosed(true);
            fadeOutTimer.current = null;
        }, 251);
    };

    useEffect(() => {
        fadeIn();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const close = () => {
        fadeOut();
    };

    const onKeyUp = (ev: KeyboardEvent) => {
        if (ev.code === "Escape" && !closedRef.current) {
            close();
        }
    };

    const clickScroll = (type: "up" | "down") => {
        if (!groupElement.current) return;
        const y = type === "up" ? 0 : groupElement.current.scrollHeight;
        groupElement.current.scroll(0, y);
    };

    const clickHandle = (ev: React.MouseEvent) => {
        if (ev.target !== groupElement.current) return;

        const selection = window.getSelection();
        if (selection && selection.toString().length !== 0) return;

        close();
    };

    const wheelHandle = (ev: React.WheelEvent) => {
        if (typeof onScroll === "function") {
            onScroll(ev.nativeEvent, groupElement.current as HTMLElement);
        }
    };

    const setScrollMode = (mode: "top" | "bottom" | "none") => {
        setScrollModeTop(mode === "top");
        setScrollModeBottom(mode === "bottom");
    };

    const clearScrollMode = () => setScrollMode("none");

    const onClose = (handler: () => void) => {
        frames.forEach((frame) => frame.onClose(handler));
    };

    // 명령형 API (Frame 클래스가 사용)
    useEffect(() => {
        apiRef.current = {
            get closed() {
                return closedRef.current;
            },
            set closed(v: boolean) {
                setClosed(v);
            },
            get inputFocus() {
                return inputFocus.current;
            },
            get groupElement() {
                return groupElement.current;
            },
            get commentFrameRef() {
                return commentFrameRef.current;
            },
            setScrollMode,
            clearScrollMode,
            close,
            fadeIn,
            onClose
        };
    });

    const className = [
        "refresher-frame-outer",
        background ? "background" : "",
        blur ? "blur" : "",
        fade ? "fadeIn" : "fadeOut",
        fade ? "stack" : ""
    ].filter(Boolean).join(" ");

    return (
        <InputFocusContext.Provider value={inputFocus}>
            <div
                className={className}
                style={{display: closed ? "none" : undefined}}
            >
                <div
                    className="refresher-group"
                    onClick={clickHandle}
                    onWheel={wheelHandle}
                    ref={groupElement}
                >
                    {frames[0] && (
                        <Frame
                            frame={frames[0]}
                            index={0}
                        />
                    )}
                    {frames[1] && (
                        <Frame
                            frame={frames[1]}
                            index={1}
                            registerIncrement={(fn) => {
                                commentFrameRef.current = {incrementCommentKey: fn};
                            }}
                        />
                    )}

                    <div id="scroll">
                        <ChevronUp
                            className="scroll-icon"
                            onClick={() => clickScroll("up")}
                        />
                        <ChevronDown
                            className="scroll-icon"
                            onClick={() => clickScroll("down")}
                        />
                    </div>
                </div>
                {scrollModeTop && <ScrollIndicator side="top"/>}
                {scrollModeBottom && <ScrollIndicator side="bottom"/>}
            </div>
        </InputFocusContext.Provider>
    );
}
