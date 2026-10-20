import type {Dialog as DialogPrimitive} from "@base-ui/react/dialog";
import {FileUp, Search} from "lucide-react";
import {type ComponentProps, type ReactNode, useEffect, useRef, useState} from "react";
import {storage, type WxtStorageItem} from "wxt/utils/storage";

import {DialogActions, ModalDialog} from "@/components/dialogs";
import {Button} from "@/components/ui/button";
import {Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Empty, EmptyDescription} from "@/components/ui/empty";
import {InputGroup, InputGroupAddon, InputGroupInput} from "@/components/ui/input-group";
import {Spinner} from "@/components/ui/spinner";
import {Textarea} from "@/components/ui/textarea";
import {sendMessage} from "@/core/messaging/protocol";
import {USAGE_KEY} from "@/core/storage/items";
import type {UsageKind} from "@/core/usage";

import {type Done, notify, notifyDone} from "./optionsStore";

/** 저장소 항목 하나의 값. 배경·다른 탭에서 바뀌어도 따라가고, 읽기 전에는 fallback이다. */
export const useStorageItem = <T, >(item: WxtStorageItem<T, {}>): T => {
    const [value, setValue] = useState(item.fallback);

    useEffect(() => {
        // 읽기보다 변경 알림이 먼저 오면 늦게 온 읽기 결과가 새 값을 덮지 않게 한다.
        let watched = false;
        item.getValue().then((next) => {
            if (!watched) setValue(next);
        }, console.error);
        return item.watch((next) => {
            watched = true;
            setValue(next);
        });
    }, [item]);

    return value;
};

export const formatTime = (time: number): string => (time === 0 ? "기록 없음" : new Date(time).toLocaleString("ko-KR"));

export const formatBytes = (bytes: number): string =>
    bytes < 1024 ? `${bytes}B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)}KB` : `${(bytes / 1024 / 1024).toFixed(2)}MB`;

/**
 * 지운 항목의 기록을 이미 정리한 종류. 탭을 옮겨 다시 마운트돼도 삭제 알림의 되돌리기(20초)는 남으므로 페이지당 한 번만 정리한다.
 */
const pruned = new Set<UsageKind>();

/**
 * 차단 항목·메모가 이 기기에서 마지막으로 쓰인 시각 (core/usage). 목록이 바뀌면 기록을 목록에 맞추고, 콘텐츠 스크립트가 적으면 따라간다.
 * 지운 항목의 기록은 페이지를 열 때 정리하고, 그 뒤에 지운 것은 되돌리기로 되살릴 수 있게 남긴다.
 * ids는 목록이 바뀔 때만 새로 만들어야 한다 (렌더마다 새 배열이면 매번 저장소를 읽는다).
 */
export const useUsage = (kind: UsageKind, ids: readonly string[]): Record<string, number> => {
    const [times, setTimes] = useState<Record<string, number>>({});

    useEffect(() => {
        // 기록이 바뀌지 않았으면 저장소 이벤트가 오지 않으므로 응답으로 채운다. 응답을 기다리는 동안 watch가 먼저 오면
        // (배경이 저장소에 쓰고 같은 값을 돌려준다) 그 새 값을 응답이 덮지 않게 버린다.
        let stale = false;
        sendMessage("refresher:syncUsage", {kind, ids: [...ids], prune: !pruned.has(kind)}).then((next) => {
            if (!stale) setTimes(next);
        }, console.error);
        pruned.add(kind);
        const unwatch = storage.watch<Record<UsageKind, Record<string, number>>>(USAGE_KEY, (next) => {
            stale = true;
            if (next) setTimes(next[kind] ?? {});
        });
        return () => {
            stale = true;
            unwatch();
        };
    }, [kind, ids]);

    return times;
};

/** data를 JSON 파일(name-YYYYMMDD.json)로 내려받는다. 옵션 페이지라 downloads 권한 없이 a[download]로 된다. */
export const downloadJson = (name: string, data: unknown): void => {
    const now = new Date();
    const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], {type: "application/json"}));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${name}-${date}.json`;
    link.click();
    // 바로 풀면 내려받기가 시작되기 전에 주소가 사라지는 브라우저가 있어 조금 두었다가 푼다.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

export const Section = ({title, desc, actions, children}: {
    title?: ReactNode;
    desc?: ReactNode;
    actions?: ReactNode;
    children?: ReactNode
}) => (
    <Card className="mb-4">
        {(title || desc || actions) && (
            <CardHeader>
                {title && <CardTitle><h2>{title}</h2></CardTitle>}
                {desc && <CardDescription>{desc}</CardDescription>}
                {actions && <CardAction className="flex items-center gap-2">{actions}</CardAction>}
            </CardHeader>
        )}
        {children && <CardContent>{children}</CardContent>}
    </Card>
);

/** 돋보기가 붙은 검색 입력. className은 감싸는 InputGroup에 붙는다. */
export const SearchInput = ({className, ...props}: ComponentProps<typeof InputGroupInput>) => (
    <InputGroup className={className}>
        <InputGroupAddon>
            <Search/>
        </InputGroupAddon>
        <InputGroupInput type="search" {...props}/>
    </InputGroup>
);

/** 빈 목록·검색 결과 없음 안내. */
export const EmptyList = ({children}: { children: ReactNode }) => (
    <Empty>
        <EmptyDescription>{children}</EmptyDescription>
    </Empty>
);

/**
 * 내보낸 JSON을 붙여넣거나 파일에서 불러오는 가져오기 다이얼로그(차단/메모/데이터 공용).
 * 열 때만 마운트하므로 닫으면 입력이 초기화되고, 가져오기에 실패해 열려 있으면 붙여넣은 텍스트가 남는다.
 */
export const ImportDialog = ({title, desc = "내보낸 JSON 데이터를 붙여 넣거나 파일에서 불러와 주세요.", placeholder = "JSON 데이터", fromFile = true, onClose, onSubmit}: {
    title: string;
    desc?: ReactNode;
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
