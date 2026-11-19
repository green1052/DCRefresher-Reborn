import {FileUp} from "lucide-preact";
import type { ComponentChild } from "preact";
import { useRef, useState } from "preact/hooks";

import {DialogActions, DialogDescription, DialogHeader, DialogTitle, ModalDialog} from "@/components/dialogs";

import {type Done, notify, notifyDone} from "../optionsStore";

// 열 때만 마운트해 닫으면 입력이 초기화된다.
export const ImportDialog = ({title, desc = "내보낸 JSON 데이터를 붙여 넣거나 파일에서 불러와 주세요.", placeholder = "JSON 데이터", fromFile = true, onClose, onSubmit}: {
    title: string;
    desc?: ComponentChild;
    placeholder?: string;
    fromFile?: boolean;
    onClose: () => void;
    /** 성공 문구를 돌려주고 실패는 직접 알린다 - undefined면 창을 열어 둔다. */
    onSubmit: (text: string) => Promise<Done | undefined>;
}) => {
    const [text, setText] = useState("");
    const [busy, setBusy] = useState(false);
    const actions = useRef<{close: () => void} | null>(null);
    const input = useRef<HTMLTextAreaElement>(null);
    const file = useRef<HTMLInputElement>(null);

    const submit = async (value: string): Promise<void> => {
        setBusy(true);
        const done = await onSubmit(value).finally(() => setBusy(false));
        if (!done) return;
        actions.current?.close();
        notifyDone(done);
    };

    const submitFile = async (picked: File | undefined): Promise<void> => {
        // 같은 파일을 다시 골라도 change가 오도록 비운다.
        if (file.current) file.current.value = "";
        if (!picked) return;
        let value: string;
        try {
            value = await picked.text();
        } catch (e) {
            console.error(e);
            notify("파일을 읽지 못했습니다.");
            return;
        }
        await submit(value);
    };

    // 가져오는 중에는 닫지 않는다. 다 들어가기 전에 닫혀 끝난 줄 알지 않게 한다.
    return (
        <ModalDialog actionsRef={actions} dismissible={!busy} focusOnOpen={input} className="sm:max-w-[520px]" onClose={onClose}>
            <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>{desc}</DialogDescription>
            </DialogHeader>

            <textarea ref={input} placeholder={placeholder} aria-label={placeholder} value={text} rows={8}
                      className="textarea max-h-[50vh] w-full"
                      onInput={(ev) => setText(ev.currentTarget.value)}/>

            <DialogActions cancelDisabled={busy}>
                {fromFile && (
                    <>
                        <input ref={file} type="file" accept=".json,application/json" hidden aria-label="JSON 파일"
                               onChange={(ev) => void submitFile(ev.currentTarget.files?.[0])}/>
                        <button type="button" className="btn" disabled={busy} onClick={() => file.current?.click()}>
                            <FileUp className="size-4"/> 파일에서 불러오기
                        </button>
                    </>
                )}
                <button type="button" className="btn btn-primary" disabled={busy || !text.trim()} onClick={() => void submit(text)}>
                    {busy && <span aria-hidden className="loading loading-spinner"/>}가져오기
                </button>
            </DialogActions>
        </ModalDialog>
    );
};
