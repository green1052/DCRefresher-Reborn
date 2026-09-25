import {Box, Button, Card, Flex, IconButton, Popover, Separator, Text, Theme} from "@radix-ui/themes";
import {CircleAlert, Copy, Info, TriangleAlert, X} from "lucide-react";
import {Popover as PopoverPrimitive} from "radix-ui";
import {useEffect, useState} from "react";

import {eventBus} from "@/core/eventbus/bus";
import type {ModuleEventData} from "@/core/eventbus/types";
import {PreviewHost} from "@/features/preview/ui/PreviewHost";
import {type ToastData, useUiStore} from "@/stores/ui";
import {ipInfoOf} from "@/core/database";

import {MemoDialog} from "./MemoDialog";
import {overlay} from "./shadow";

/** 디시 다크모드(#css-darkmode 스타일시트)를 따라간다 */
const useDcAppearance = (): "light" | "dark" => {
    const detect = (): "light" | "dark" => (document.getElementById("css-darkmode") ? "dark" : "light");
    const [appearance, setAppearance] = useState(detect);

    useEffect(() => {
        const observer = new MutationObserver(() => setAppearance(detect()));
        observer.observe(document.head, {childList: true});
        return () => observer.disconnect();
    }, []);

    return appearance;
};

const TOAST_ICONS = {
    info: <Info size={16} color="var(--accent-11)"/>,
    warning: <TriangleAlert size={16} color="var(--amber-11)"/>,
    error: <CircleAlert size={16} color="var(--red-11)"/>
};

const ToastItem = ({toast}: { toast: ToastData }) => {
    useEffect(() => {
        if (toast.autoClose <= 0) return;
        const timer = setTimeout(() => useUiStore.getState().dismissToast(toast.id), toast.autoClose);
        return () => clearTimeout(timer);
    }, [toast]);

    return (
        <Card size="2" role="status" className="refresher-toast refresher-interactive"
              style={toast.onClick ? {cursor: "pointer"} : undefined} onClick={toast.onClick}>
            <Flex align="center" gap="3">
                {TOAST_ICONS[toast.type]}
                <Text size="2" style={{flex: 1}}>{toast.content}</Text>
                <IconButton
                    size="1"
                    variant="ghost"
                    color="gray"
                    aria-label="닫기"
                    onClick={(event) => {
                        event.stopPropagation();
                        useUiStore.getState().dismissToast(toast.id);
                    }}
                >
                    <X size={14}/>
                </IconButton>
            </Flex>
        </Card>
    );
};

const ToastHost = () => {
    const toast = useUiStore((s) => s.toast);
    if (!toast) return null;
    return <ToastItem key={toast.id} toast={toast}/>;
};

/** 클릭하면 복사되는 값 한 줄 */
const CopyRow = ({label, value, onCopy}: { label: string; value: string; onCopy: (value: string) => void }) => (
    <Button variant="ghost" color="gray" size="1" title="클릭하면 복사됩니다." onClick={() => onCopy(value)}
            style={{justifyContent: "space-between", margin: 0}}>
        <Text truncate>
            <Text color="gray">{label}</Text> <Text weight="bold" highContrast>{value}</Text>
        </Text>
        <Copy size={12}/>
    </Button>
);

/** 아이디와 IP는 한 줄에 병합: "uid (IP)" */
const identityValue = (selected: { uid?: string; ip?: string }): string | undefined => {
    if (selected.uid) return selected.ip ? `${selected.uid} (${selected.ip})` : selected.uid;
    return selected.ip;
};

const BubbleHost = () => {
    const bubble = useUiStore((s) => s.bubble);
    const selected = useUiStore((s) => s.selected);

    // Popover는 스크롤을 따라가지 않으므로 스크롤시 닫는다
    useEffect(() => {
        if (!bubble) return;
        const onScroll = (): void => useUiStore.getState().closeBubble();
        window.addEventListener("scroll", onScroll, true);
        return () => window.removeEventListener("scroll", onScroll, true);
    }, [bubble]);

    if (!bubble || !selected) return null;

    const close = (): void => useUiStore.getState().closeBubble();
    const copy = (value: string): void => {
        close();
        void navigator.clipboard.writeText(value).then(() => useUiStore.getState().showToast("복사했습니다."));
    };
    const requestBlock = (payload: ModuleEventData["refresherRequestBlock"]): void => {
        eventBus.emit("refresherRequestBlock", payload);
        close();
    };

    const identity = identityValue(selected);
    const ipLabel = selected.ip ? ipInfoOf(selected.ip)?.label : undefined;

    return (
        <Popover.Root open onOpenChange={(open) => !open && close()}>
            {/* Themes Popover.Anchor는 children을 버리므로(3.3.0) 프리미티브 Anchor를 쓴다 */}
            <PopoverPrimitive.Anchor asChild>
                <span className="refresher-anchor" style={{left: bubble.x, top: bubble.y}}/>
            </PopoverPrimitive.Anchor>
            <Popover.Content container={overlay.portal} side="bottom" align="start" sideOffset={4} size="1"
                             minWidth="200px" maxWidth="320px" onOpenAutoFocus={(event) => event.preventDefault()}>
                {selected.dccon ? (
                    <Flex gap="2">
                        <Button size="1" onClick={() => requestBlock({target: "dccon"})}>디시콘 차단</Button>
                        <Button size="1" variant="soft" color="gray"
                                onClick={() => requestBlock({target: "dccon", blockAllDccon: true})}>
                            디시콘 전체 차단
                        </Button>
                    </Flex>
                ) : (
                    <>
                        <Flex direction="column" gap="2">
                            {selected.nick && <CopyRow label="닉네임" value={selected.nick} onCopy={copy}/>}
                            {identity && <CopyRow label="아이디/IP" value={identity} onCopy={copy}/>}
                            {ipLabel && <CopyRow label="IP 정보" value={ipLabel} onCopy={copy}/>}
                        </Flex>
                        <Separator size="4" my="2"/>
                        <Flex gap="2" wrap="wrap">
                            <Button size="1" color="red" variant="soft" onClick={() => requestBlock({target: "user"})}>
                                유저 차단
                            </Button>
                            <Button size="1" variant="soft" color="gray"
                                    onClick={() => useUiStore.getState().openMemoForSelected()}>
                                메모
                            </Button>
                            {selected.uid && (
                                <Button size="1" variant="soft" color="gray" asChild>
                                    <a href={`https://gallog.dcinside.com/${selected.uid}`} target="_blank"
                                       rel="noreferrer" onClick={close}>
                                        갤로그
                                    </a>
                                </Button>
                            )}
                        </Flex>
                    </>
                )}
            </Popover.Content>
        </Popover.Root>
    );
};

const MemoHost = () => {
    const memo = useUiStore((s) => s.memo);
    if (!memo) return null;
    return <MemoDialog key={JSON.stringify(memo)}/>;
};

export const ContentRoot = () => {
    const appearance = useDcAppearance();

    return (
        <Theme appearance={appearance} accentColor="blue" radius="medium" panelBackground="solid"
               hasBackground={false}>
            <Box>
                <ToastHost/>
                <BubbleHost/>
                <MemoHost/>
                <PreviewHost/>
            </Box>
        </Theme>
    );
};
