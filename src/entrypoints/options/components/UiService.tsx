import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as Dialog from "@radix-ui/react-dialog";
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
// 여기 핸들러를 등록해 window.alert/confirm/prompt를 직접 그린 UI로 우회시킨다.
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
            <div className="toast-wrap">
                {toasts.map((t) => (
                    <div className="toast" key={t.id}>
                        {t.message}
                    </div>
                ))}
            </div>

            <AlertDialog.Root
                onOpenChange={(open) => {
                    if (!open) finishConfirm(false);
                }}
                open={confirmReq !== null}
            >
                <AlertDialog.Portal>
                    <AlertDialog.Overlay className="dialog-overlay"/>
                    <AlertDialog.Content className="dialog-content alert">
                        <AlertDialog.Title className="dialog-title">확인</AlertDialog.Title>
                        <AlertDialog.Description className="dialog-desc">
                            {confirmReq?.message}
                        </AlertDialog.Description>
                        <div className="dialog-actions">
                            <AlertDialog.Cancel className="btn btn-soft">취소</AlertDialog.Cancel>
                            <AlertDialog.Action className="btn" onClick={() => finishConfirm(true)}>
                                확인
                            </AlertDialog.Action>
                        </div>
                    </AlertDialog.Content>
                </AlertDialog.Portal>
            </AlertDialog.Root>

            <Dialog.Root
                onOpenChange={(open) => {
                    if (!open) finishPrompt(null);
                }}
                open={promptReq !== null}
            >
                <Dialog.Portal>
                    <Dialog.Overlay className="dialog-overlay"/>
                    <Dialog.Content className="dialog-content">
                        <Dialog.Title className="dialog-title">{promptReq?.message}</Dialog.Title>
                        <input
                            autoFocus
                            className="input"
                            onChange={(ev) =>
                                setPromptReq((prev) => (prev ? {...prev, value: ev.target.value} : prev))
                            }
                            onKeyDown={(ev) => {
                                if (ev.key === "Enter") finishPrompt(promptReq?.value ?? null);
                            }}
                            style={{marginTop: 16, width: "100%"}}
                            value={promptReq?.value ?? ""}
                        />
                        <div className="dialog-actions">
                            <Dialog.Close asChild>
                                <button className="btn btn-soft">취소</button>
                            </Dialog.Close>
                            <button className="btn" onClick={() => finishPrompt(promptReq?.value ?? null)}>
                                확인
                            </button>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </>
    );
}
