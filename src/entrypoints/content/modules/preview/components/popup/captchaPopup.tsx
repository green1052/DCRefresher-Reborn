import {useEffect, useRef, useState} from "react";

import "./captchaPopup.scss";

interface Props {
    src: string;
    onSubmit: (captcha: string) => void;
    onClose: () => void;
}

export default function CaptchaPopup({src, onSubmit, onClose}: Props) {
    const [input, setInput] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    const submit = (): void => {
        if (!input) return;
        onSubmit(input);
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            inputRef.current?.focus();
        }, 0);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="refresher-captcha-popup">
            <p>코드 입력</p>
            <div
                className="close"
                onClick={onClose}
            >
                <div className="cross"></div>
                <div className="cross"></div>
            </div>
            <img src={src}/>
            <input
                onChange={(ev) => setInput(ev.target.value)}
                onKeyDown={(ev) => {
                    if (ev.key === "Enter") submit();
                }}
                ref={inputRef}
                type="text"
                value={input}
            />
            <button
                className="refresher-preview-button primary"
                onClick={submit}
            >
                <p className="refresher-vote-text">전송</p>
            </button>
        </div>
    );
}
