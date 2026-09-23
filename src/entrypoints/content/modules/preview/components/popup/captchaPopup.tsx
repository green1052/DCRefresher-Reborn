import {Button, IconButton, Text, TextField} from "@radix-ui/themes";
import {X} from "lucide-react";
import {useState} from "react";

import "./captchaPopup.scss";

interface Props {
    src: string;
    onSubmit: (captcha: string) => void;
    onClose: () => void;
}

export default function CaptchaPopup({src, onSubmit, onClose}: Props) {
    const [input, setInput] = useState("");

    const submit = (): void => {
        if (!input) return;
        onSubmit(input);
    };

    return (
        <div className="refresher-captcha-popup">
            <Text size="4" weight="bold">코드 입력</Text>
            <IconButton
                color="gray"
                onClick={onClose}
                style={{position: "absolute", right: 10, top: 10}}
                title="닫기"
                variant="ghost"
            >
                <X height={16} width={16}/>
            </IconButton>
            <img src={src}/>
            <TextField.Root
                autoFocus
                mt="2"
                onChange={(ev) => setInput(ev.target.value)}
                onKeyDown={(ev) => {
                    if (ev.key === "Enter") submit();
                }}
                size="2"
                style={{width: "100%"}}
                value={input}
            />
            <Button
                className="refresher-preview-button primary"
                onClick={submit}
                variant="solid"
            >
                <Text className="refresher-vote-text">전송</Text>
            </Button>
        </div>
    );
}
