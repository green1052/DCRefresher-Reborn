import type {Dialog as DialogPrimitive} from "@base-ui/react/dialog";
import {FileUp} from "lucide-react";
import {useRef, useState} from "react";

import {DialogActions, ModalDialog} from "@/components/dialogs";
import {Button} from "@/components/ui/button";
import {DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Spinner} from "@/components/ui/spinner";
import {Textarea} from "@/components/ui/textarea";

import {type Done, notify, notifyDone} from "../optionsStore";

/**
 * 내보낸 JSON을 붙여넣거나 파일에서 불러오는 가져오기 다이얼로그(차단/메모/데이터 공용).
 * 열 때만 마운트하므로 닫으면 입력이 초기화되고, 가져오기에 실패해 열려 있으면 붙여넣은 텍스트가 남는다.
 */
export const ImportDialog = ({title, desc = "내보낸 JSON 데이터를 붙여 넣거나 파일에서 불러와 주세요.", placeholder = "JSON 데이터", fromFile = true, onClose, onSubmit}: {
    title: string;
    desc?: React.ReactNode;
    /** 입력칸 안내이자 이름. */
    placeholder?: string;
    /** JSON 파일에서 불러오기 버튼을 단다. 고른 파일의 내용을 바로 가져온다. */
    fromFile?: boolean;
    onClose: () => void;
    /** 가져왔으면 알림 문구를 돌려준다. 실패는 직접 알리고 undefined를 돌려줘 다이얼로그를 열어 둔다. */
    onSubmit: (text: string) => Promise<Done | undefined>;
}) => {
    const [text, setText] = useState("");
    const [busy, setBusy] = useState(false);
    const actions = useRef<DialogPrimitive.Root.Actions>(null);
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

            <Textarea ref={input} placeholder={placeholder} aria-label={placeholder} value={text} rows={8} className="max-h-[50vh]"
                      onChange={(ev) => setText(ev.target.value)}/>

            <DialogActions cancelDisabled={busy}>
                {fromFile && (
                    <>
                        <input ref={file} type="file" accept=".json,application/json" hidden aria-label="JSON 파일"
                               onChange={(ev) => void submitFile(ev.currentTarget.files?.[0])}/>
                        <Button variant="secondary" disabled={busy} onClick={() => file.current?.click()}>
                            <FileUp data-icon="inline-start"/> 파일에서 불러오기
                        </Button>
                    </>
                )}
                <Button disabled={busy || !text.trim()} onClick={() => void submit(text)}>
                    {busy && <Spinner aria-hidden data-icon="inline-start"/>}가져오기
                </Button>
            </DialogActions>
        </ModalDialog>
    );
};
