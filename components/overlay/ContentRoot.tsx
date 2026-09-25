import {Box, Button, Card, Flex, IconButton, Popover, Separator, Text, Theme} from "@radix-ui/themes";
import {CircleAlert, Copy, Info, TriangleAlert, X} from "lucide-react";
import {Popover as PopoverPrimitive} from "radix-ui";
import {useEffect, useState} from "react";

import {blockingEntries} from "@/core/block";
import {type BlockRequestOptions, handleBlockRequest} from "@/features/block/request";
import {PreviewHost} from "@/features/preview/ui/PreviewHost";
import {type ToastData, useUiStore} from "@/stores/ui";
import {banReasonsOf, ipInfoOf} from "@/core/database";
import {queryString} from "@/core/http/urls";
import {TYPE_NAMES} from "@/core/storage/items";
import type {BlockEntry, BlockType} from "@/core/storage/types";
import {useBlocksStore} from "@/stores/blocks";
import {useUserMemo} from "@/stores/memos";
import {type ActivityState, useGallogActivity} from "@/utils/gallogActivity";

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
                    onClick={(ev) => {
                        ev.stopPropagation();
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

const formatActivity = (activity: ActivityState): string | undefined => {
    if (activity === "loading") return "불러오는 중…";
    if (activity === "error") return "불러오지 못함";
    if (!activity) return undefined;
    return `${activity.article.toLocaleString()} / ${activity.comment.toLocaleString()}`;
};

/** 아이디와 IP는 한 줄에 병합: "uid (IP)" */
const identityValue = (selected: { uid?: string; ip?: string }): string | undefined => {
    if (selected.uid) return selected.ip ? `${selected.uid} (${selected.ip})` : selected.uid;
    return selected.ip;
};

/** 규칙 하나 해제 — 토스트를 누르면 되돌린다 */
const unblock = async (type: BlockType, {id, ...fields}: BlockEntry): Promise<void> => {
    await useBlocksStore.getState().removeEntry(type, id);
    // 정규식은 한 규칙이 여러 대상을 막는다
    const others = fields.isRegex ? " 같은 규칙에 걸린 다른 대상도 풀렸습니다." : "";
    useUiStore.getState().showToast(`차단을 해제했습니다.${others} 누르면 되돌립니다.`, "info", 5000, () => {
        useUiStore.getState().dismissToast();
        void useBlocksStore.getState().addEntry(type, fields);
    });
};

/** 이 대상을 막고 있는 차단 규칙 — 왜 가려졌는지 보고 그 자리에서 푼다 */
const BlockRules = ({rules}: { rules: { type: BlockType; entry: BlockEntry }[] }) => (
    <>
        <Separator size="4" my="2"/>
        <Text as="p" size="1" color="gray" mb="1">걸린 차단 규칙</Text>
        <Flex direction="column" gap="1">
            {rules.map(({type, entry}) => (
                <Flex key={entry.id} align="center" justify="between" gap="2">
                    <Text size="1" truncate title={entry.isRegex ? "정규식 — 풀면 이 규칙에 걸린 다른 대상도 함께 풀립니다." : undefined}>
                        <Text color="gray">{TYPE_NAMES[type]}</Text> {type === "DCCON" ? entry.extra || entry.content : entry.content}
                        {entry.isRegex && <Text color="gray"> (정규식)</Text>}
                        {entry.gallery && <Text color="gray"> (이 갤러리만)</Text>}
                    </Text>
                    <Button size="1" variant="ghost" color="red" style={{flexShrink: 0}} onClick={() => void unblock(type, entry)}>해제</Button>
                </Flex>
            ))}
        </Flex>
    </>
);

const BubbleHost = () => {
    const bubble = useUiStore((s) => s.bubble);
    const selected = useUiStore((s) => s.selected);
    const activityState = useGallogActivity(bubble && selected && !selected.dccon ? selected.uid : undefined);
    const memo = useUserMemo(selected ?? {}, queryString("id"));
    // 구독한 목록으로 찾아야 해제하면 바로 다시 계산된다
    const entries = useBlocksStore((s) => s.entries);
    const defaults = useBlocksStore((s) => s.defaults);
    const rules = selected
        ? blockingEntries(selected.dccon ? {DCCON: selected.dccon} : {NICK: selected.nick, ID: selected.uid, IP: selected.ip}, queryString("id") ?? undefined, {entries, defaults})
        : [];

    // Popover는 스크롤을 따라가지 않으므로 스크롤시 닫는다 — scroll은 섀도 루트 밖으로 나가지 않아 미리보기 스크롤은 루트에서 잡는다
    useEffect(() => {
        if (!bubble) return;
        const onScroll = (): void => useUiStore.getState().closeBubble();
        const root = overlay.portal?.getRootNode();
        window.addEventListener("scroll", onScroll, true);
        root?.addEventListener("scroll", onScroll, true);
        return () => {
            window.removeEventListener("scroll", onScroll, true);
            root?.removeEventListener("scroll", onScroll, true);
        };
    }, [bubble]);

    if (!bubble || !selected) return null;

    const close = (): void => useUiStore.getState().closeBubble();
    const copy = (value: string): void => {
        close();
        void navigator.clipboard.writeText(value).then(() => useUiStore.getState().showToast("복사했습니다."));
    };
    // 이벤트로 보내면 차단 모듈이 꺼져 있을 때 아무도 받지 않아 조용히 무시된다 — 직접 부른다
    const requestBlock = (options: BlockRequestOptions): void => {
        void handleBlockRequest(options, selected);
        close();
    };

    const identity = identityValue(selected);
    const ipLabel = selected.ip ? ipInfoOf(selected.ip)?.label : undefined;
    const bans = selected.uid ? banReasonsOf(selected.uid) : undefined;
    const activity = formatActivity(activityState);

    return (
        <Popover.Root open onOpenChange={(open) => !open && close()}>
            {/* Themes Popover.Anchor는 children을 버리므로(3.3.0) 프리미티브 Anchor를 쓴다 */}
            <PopoverPrimitive.Anchor asChild>
                <span className="refresher-anchor" style={{left: bubble.x, top: bubble.y}}/>
            </PopoverPrimitive.Anchor>
            <Popover.Content container={overlay.portal} side="bottom" align="start" sideOffset={4} size="1"
                             minWidth="200px" maxWidth="320px" onOpenAutoFocus={(ev) => ev.preventDefault()}>
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
                            {activity && <CopyRow label="글/댓글" value={activity} onCopy={copy}/>}
                            {bans && <CopyRow label="차단된 갤러리" value={bans} onCopy={copy}/>}
                            {memo && <CopyRow label="메모" value={memo.text} onCopy={copy}/>}
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
                {rules.length > 0 && <BlockRules rules={rules}/>}
            </Popover.Content>
        </Popover.Root>
    );
};

export const ContentRoot = () => {
    const appearance = useDcAppearance();

    return (
        <Theme appearance={appearance} accentColor="blue" radius="medium" panelBackground="solid"
               hasBackground={false}>
            <Box>
                <ToastHost/>
                <BubbleHost/>
                <MemoDialog/>
                <PreviewHost/>
            </Box>
        </Theme>
    );
};
