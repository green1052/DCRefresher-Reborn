import {Box, Button, Card, Dialog, Flex, Heading, Text, TextArea} from "@radix-ui/themes";
import {type ReactNode, useEffect, useRef, useState} from "react";
import {storage, type WxtStorageItem} from "wxt/utils/storage";

import {DialogActions} from "@/components/ConfirmDialog";
import {sendMessage} from "@/core/messaging/protocol";
import {USAGE_KEY, type UsageKind} from "@/core/usage";
import {useOpenerFocus} from "@/components/useOpenerFocus";

import {notify} from "./optionsStore";

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

/** 저장 시각 표시 (0이면 기록 없음). */
export const formatTime = (time: number): string => (time === 0 ? "기록 없음" : new Date(time).toLocaleString("ko-KR"));

/** JSON으로 저장했을 때의 크기 (바이트). */
export const byteSize = (value: unknown): number => new Blob([JSON.stringify(value)]).size;

export const formatBytes = (bytes: number): string =>
    bytes < 1024 ? `${bytes}B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)}KB` : `${(bytes / 1024 / 1024).toFixed(2)}MB`;

/**
 * 차단 항목·메모가 이 기기에서 마지막으로 쓰인 시각 (core/usage). 목록이 바뀌면 기록을 목록에 맞추고, 콘텐츠 스크립트가 적으면 따라간다.
 * ids는 목록이 바뀔 때만 새로 만들어야 한다 (렌더마다 새 배열이면 매번 저장소를 읽는다).
 */
export const useUsage = (kind: UsageKind, ids: readonly string[]): Record<string, number> => {
    const [times, setTimes] = useState<Record<string, number>>({});

    useEffect(() => {
        // 기록이 바뀌지 않았으면 저장소 이벤트가 오지 않으므로 응답으로 채운다. 응답을 기다리는 동안 watch가 먼저 오면
        // (배경이 저장소에 쓰고 같은 값을 돌려준다) 그 새 값을 응답이 덮지 않게 버린다.
        let stale = false;
        sendMessage("refresher:syncUsage", {kind, ids: [...ids]}).then((next) => {
            if (!stale) setTimes(next);
        }, console.error);
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

/** 옵션 페이지 섹션 카드. 스타일은 Radix Themes prop만 쓴다. */
export const Section = ({title, desc, actions, children}: {
    title?: ReactNode;
    desc?: ReactNode;
    actions?: ReactNode;
    children?: ReactNode
}) => (
    <Card size="3" mb="4">
        {(title || desc || actions) && (
            <Flex justify="between" align="center" gap="4" wrap="wrap" mb={children ? "4" : "0"}>
                <Box minWidth="0">
                    {title && <Heading as="h2" size="4">{title}</Heading>}
                    {desc && <Text as="p" size="2" color="gray">{desc}</Text>}
                </Box>
                {actions && (
                    <Flex gap="2" align="center" ml="auto">
                        {actions}
                    </Flex>
                )}
            </Flex>
        )}
        {children}
    </Card>
);

/**
 * 내보낸 JSON을 붙여넣는 가져오기 다이얼로그(차단/메모/데이터 공용).
 * 열 때만 마운트하므로 닫으면 입력이 초기화되고, 가져오기에 실패해 열려 있으면 붙여넣은 텍스트가 남는다.
 */
export const ImportDialog = ({title, desc = "내보낸 JSON 데이터를 붙여 넣어 주세요.", placeholder = "JSON 데이터", onClose, onSubmit}: {
    title: string;
    desc?: ReactNode;
    /** 입력칸 안내이자 이름. */
    placeholder?: string;
    onClose: () => void;
    /** 가져왔으면 알림 문구를 돌려준다. 실패는 직접 알리고 undefined를 돌려줘 다이얼로그를 열어 둔다. */
    onSubmit: (text: string) => Promise<string | undefined>;
}) => {
    const [text, setText] = useState("");
    const [busy, setBusy] = useState(false);
    const done = useRef<string>(undefined);
    const focus = useOpenerFocus();

    const submit = async (): Promise<void> => {
        setBusy(true);
        done.current = await onSubmit(text).finally(() => setBusy(false));
        if (done.current) onClose();
    };

    // 가져오는 중에는 닫지 않는다. 닫으면 가져오기는 끝나도 알림이 뜨지 않는다.
    return (
        <Dialog.Root open onOpenChange={(next) => !next && !busy && onClose()}>
            {/* 가져왔다는 알림은 포커스를 가져오기 버튼에 돌려준 뒤에 띄운다.
                먼저 띄우면 알림이 곧 사라질 이 다이얼로그의 버튼을 연 요소로 기억해, 알림을 닫을 때 포커스가 body로 떨어진다 */}
            <Dialog.Content maxWidth="520px" onCloseAutoFocus={(ev) => {
                focus.onCloseAutoFocus(ev);
                if (done.current) notify(done.current);
            }}>
                <Dialog.Title>{title}</Dialog.Title>
                <Dialog.Description size="2" mb="3">
                    {desc}
                </Dialog.Description>

                <TextArea placeholder={placeholder} aria-label={placeholder} value={text} rows={8} autoFocus
                          onChange={(ev) => setText(ev.target.value)}/>

                <DialogActions>
                    <Button loading={busy} disabled={!text.trim()} onClick={() => void submit()}>가져오기</Button>
                </DialogActions>
            </Dialog.Content>
        </Dialog.Root>
    );
};
