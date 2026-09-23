import {AlertDialog, Box, Button, Dialog, Flex, TextField} from "@radix-ui/themes";
import {useEffect, useState} from "react";

interface ConfirmRequest {
    message: string;
    resolve: (value: boolean) => void;
}

interface PromptRequest {
    message: string;
    value: string;
    resolve: (value: string | null) => void;
}

interface Ui {
    alert: (message: string) => void;
    confirm: (message: string) => Promise<boolean>;
    prompt: (message: string, initial?: string) => Promise<string | null>;
}

// 훅은 컴포넌트 밖(콜백 깊숙이)에서도 다이얼로그를 띄운다. UiService가 마운트되면
// 여기 핸들러를 등록해 window.alert/confirm/prompt를 Themes UI로 우회시킨다.
let impl: Ui | null = null;

export const ui: Ui = {
    alert: (message) => (impl ? impl.alert(message) : window.alert(message)),
    confirm: (message) => (impl ? impl.confirm(message) : Promise.resolve(window.confirm(message))),
    prompt: (message, initial) =>
        impl ? impl.prompt(message, initial) : Promise.resolve(window.prompt(message, initial))
};

export default function UiService() {
    const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null);
    const [promptReq, setPromptReq] = useState<PromptRequest | null>(null);
    const [toasts, setToasts] = useState<{id: number; message: string}[]>([]);

    useEffect(() => {
        impl = {
            alert: (message) => {
                const id = Date.now() + Math.random();
                setToasts((prev) => [...prev, {id, message}]);
                setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
            },
            confirm: (message) => new Promise((resolve) => setConfirmReq({message, resolve})),
            prompt: (message, initial) =>
                new Promise((resolve) => setPromptReq({message, value: initial ?? "", resolve}))
        };
        return () => {
            impl = null;
        };
    }, []);

    const finishConfirm = (value: boolean) => {
        confirmReq?.resolve(value);
        setConfirmReq(null);
    };

    const finishPrompt = (value: string | null) => {
        promptReq?.resolve(value);
        setPromptReq(null);
    };

    return (
        <>
            <div
                style={{
                    alignItems: "center",
                    bottom: 16,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    left: "50%",
                    pointerEvents: "none",
                    position: "fixed",
                    transform: "translateX(-50%)",
                    zIndex: 1000
                }}
            >
                {toasts.map((t) => (
                    <Box
                        key={t.id}
                        style={{
                            background: "var(--gray-12)",
                            borderRadius: "var(--radius-3)",
                            boxShadow: "var(--shadow-4)",
                            color: "var(--gray-1)",
                            fontSize: 13,
                            padding: "8px 16px"
                        }}
                    >
                        {t.message}
                    </Box>
                ))}
            </div>

            <AlertDialog.Root
                onOpenChange={(open) => {
                    if (!open) finishConfirm(false);
                }}
                open={confirmReq !== null}
            >
                <AlertDialog.Content maxWidth="420px">
                    <AlertDialog.Title>확인</AlertDialog.Title>
                    <AlertDialog.Description size="2">{confirmReq?.message}</AlertDialog.Description>
                    <Flex gap="3" justify="end" mt="4">
                        <AlertDialog.Cancel>
                            <Button color="gray" variant="soft">취소</Button>
                        </AlertDialog.Cancel>
                        <AlertDialog.Action>
                            <Button onClick={() => finishConfirm(true)}>확인</Button>
                        </AlertDialog.Action>
                    </Flex>
                </AlertDialog.Content>
            </AlertDialog.Root>

            <Dialog.Root
                onOpenChange={(open) => {
                    if (!open) finishPrompt(null);
                }}
                open={promptReq !== null}
            >
                <Dialog.Content maxWidth="520px">
                    <Dialog.Title>{promptReq?.message}</Dialog.Title>
                    <TextField.Root
                        autoFocus
                        mt="4"
                        onChange={(ev) =>
                            setPromptReq((prev) => (prev ? {...prev, value: ev.target.value} : prev))
                        }
                        onKeyDown={(ev) => {
                            if (ev.key === "Enter") finishPrompt(promptReq?.value ?? null);
                        }}
                        style={{width: "100%"}}
                        value={promptReq?.value ?? ""}
                    />
                    <Flex gap="3" justify="end" mt="4">
                        <Dialog.Close>
                            <Button color="gray" variant="soft">취소</Button>
                        </Dialog.Close>
                        <Button onClick={() => finishPrompt(promptReq?.value ?? null)}>확인</Button>
                    </Flex>
                </Dialog.Content>
            </Dialog.Root>
        </>
    );
}
