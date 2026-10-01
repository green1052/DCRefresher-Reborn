import {Button, Dialog, Flex, Popover, Separator, Text} from "@radix-ui/themes";
import {Copy} from "lucide-react";
import {Popover as PopoverPrimitive} from "radix-ui";
import {useSyncExternalStore} from "react";

import {DialogActions} from "@/components/ConfirmDialog";
import {useOpenerFocus} from "@/components/useOpenerFocus";
import {blockingEntries} from "@/core/block";
import {banReasonsOf, databaseVersion, ipInfoOf, subscribeDatabase} from "@/core/database";
import {queryString} from "@/core/http/urls";
import {TYPE_NAMES} from "@/core/storage/items";
import type {BlockEntry, BlockType} from "@/core/storage/types";
import {type BlockRequestOptions, handleBlockRequest} from "@/stores/blockRequest";
import {useBlocksStore} from "@/stores/blocks";
import {useUserMemo} from "@/stores/memos";
import {type SelectedUser, useUiStore} from "@/stores/ui";
import {SAVE_FAILED} from "@/utils/error";
import {type ActivityState, useGallogActivity} from "@/utils/gallogActivity";

import {overlay} from "./shadow";

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

/** 아이디와 IP를 한 줄 "uid (IP)"로 합친다 */
const identityValue = ({uid, ip}: { uid?: string; ip?: string }): string | undefined => (uid && ip ? `${uid} (${ip})` : uid || ip);

/** 차단 규칙 하나를 해제한다. 토스트의 되돌리기 버튼으로 다시 걸 수 있다 */
const unblock = async (type: BlockType, {id, ...fields}: BlockEntry): Promise<void> => {
    const {showToast} = useUiStore.getState();
    const saveFailed = (): void => showToast(SAVE_FAILED, "error");
    try {
        await useBlocksStore.getState().removeEntry(type, id);
    } catch {
        saveFailed();
        return;
    }
    // 정규식은 한 규칙이 여러 대상을 막는다
    const others = fields.isRegex ? " 같은 규칙에 걸린 다른 대상도 풀렸습니다." : "";
    showToast(`차단을 해제했습니다.${others}`, "info", 5000, {
        label: "되돌리기",
        run: () => void useBlocksStore.getState().addEntry(type, fields).catch(saveFailed)
    });
};

/** 이 대상을 막고 있는 차단 규칙 목록. 왜 가려졌는지 보여 주고 그 자리에서 풀 수 있게 한다 */
const BlockRules = ({rules}: { rules: { type: BlockType; entry: BlockEntry }[] }) => (
    <>
        <Separator size="4" my="2"/>
        <Text as="p" size="1" color="gray" mb="1">걸린 차단 규칙</Text>
        <Flex direction="column" gap="1">
            {rules.map(({type, entry}) => {
                const name = type === "DCCON" ? entry.extra || entry.content : entry.content;
                return (
                    <Flex key={entry.id} align="center" justify="between" gap="2">
                        <Text size="1" truncate title={entry.isRegex ? "정규식 — 풀면 이 규칙에 걸린 다른 대상도 함께 풀립니다." : undefined}>
                            <Text color="gray">{TYPE_NAMES[type]}</Text> {name}
                            {entry.isRegex && <Text color="gray"> (정규식)</Text>}
                            {entry.gallery && <Text color="gray"> (이 갤러리만)</Text>}
                        </Text>
                        <Button size="1" variant="ghost" color="red" style={{flexShrink: 0}}
                                aria-label={`${TYPE_NAMES[type]} ${name} 차단 해제`}
                                onClick={() => void unblock(type, entry)}>해제</Button>
                    </Flex>
                );
            })}
        </Flex>
    </>
);

/** 디시콘 패키지 전체를 어떻게 차단할지 고른다. 취소하면 아무것도 차단하지 않는다 */
export const DcconPackageDialog = ({target, onClose}: { target: SelectedUser; onClose: () => void }) => {
    const {onCloseAutoFocus} = useOpenerFocus();
    const choose = (dcconPackage: "bundle" | "each"): void => {
        onClose();
        void handleBlockRequest({target: "dccon", dcconPackage}, target);
    };

    return (
        <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
            <Dialog.Content container={overlay.portal} maxWidth="400px" onCloseAutoFocus={onCloseAutoFocus}>
                <Dialog.Title>디시콘 패키지를 어떻게 차단할까요?</Dialog.Title>
                <Dialog.Description size="2" color="gray">
                    묶어서 차단하면 차단 목록에 한 항목으로 들어갑니다. 하나씩 차단하면 디시콘마다 항목이 생겨 따로 풀 수 있습니다.
                </Dialog.Description>
                <DialogActions>
                    <Button variant="soft" onClick={() => choose("each")}>하나씩 차단</Button>
                    <Button onClick={() => choose("bundle")}>묶어서 차단</Button>
                </DialogActions>
            </Dialog.Content>
        </Dialog.Root>
    );
};

interface BubbleProps {
    bubble: { x: number; y: number };
    selected: SelectedUser;
    onBlockPackage: (target: SelectedUser) => void;
}

/** 유저 버블. 열 때 마운트되어 연 요소(닉네임 버튼 등)를 기억했다가 닫을 때 그리로 포커스를 돌려준다 */
const Bubble = ({bubble, selected, onBlockPackage}: BubbleProps) => {
    const focus = useOpenerFocus();
    const activityState = useGallogActivity(selected.dccon ? undefined : selected.uid);
    const memo = useUserMemo(selected, queryString("id"));
    // 구독한 목록으로 찾아야 해제했을 때 바로 다시 계산된다
    const entries = useBlocksStore((s) => s.entries);
    const defaults = useBlocksStore((s) => s.defaults);
    const rules = blockingEntries(selected.dccon ? {DCCON: selected.dccon} : {NICK: selected.nick, ID: selected.uid, IP: selected.ip}, queryString("id") ?? undefined, {entries, defaults});
    // IP/밴 조회 식에 이 번호를 넣는다. 빠지면 React Compiler가 인자만 보고 메모해 DB를 읽은 뒤에도 옛 값이 남는다
    const dbVersion = useSyncExternalStore(subscribeDatabase, databaseVersion);

    // Popover는 스크롤을 따라가지 않으므로 스크롤하면 닫는다.
    // scroll 이벤트는 shadow root 밖으로 나가지 않으므로 미리보기 안의 스크롤은 루트에서 잡는다.
    useEffect(() => {
        const onScroll = (): void => useUiStore.getState().closeBubble();
        const controller = new AbortController();
        const options = {capture: true, signal: controller.signal};
        window.addEventListener("scroll", onScroll, options);
        overlay.portal?.getRootNode().addEventListener("scroll", onScroll, options);
        return () => controller.abort();
    }, []);

    const close = (): void => useUiStore.getState().closeBubble();
    const copy = (value: string): void => {
        close();
        navigator.clipboard.writeText(value).then(
            () => useUiStore.getState().showToast("복사했습니다."),
            () => useUiStore.getState().showToast("복사하지 못했습니다.", "error")
        );
    };
    // 이벤트로 보내면 차단 모듈이 꺼져 있을 때 받는 쪽이 없어 조용히 무시되므로 직접 부른다
    const requestBlock = (options: BlockRequestOptions): void => {
        void handleBlockRequest(options, selected);
        close();
    };

    const identity = identityValue(selected);
    const ipLabel = dbVersion > 0 && selected.ip ? ipInfoOf(selected.ip)?.label : undefined;
    const bans = dbVersion > 0 && selected.uid ? banReasonsOf(selected.uid) : undefined;
    const activity = formatActivity(activityState);

    return (
        <Popover.Root open onOpenChange={(open) => !open && close()}>
            {/* Themes Popover.Anchor는 children을 버리므로(3.3.0) 프리미티브 Anchor를 쓴다 */}
            <PopoverPrimitive.Anchor asChild>
                <span className="refresher-anchor" style={{left: bubble.x, top: bubble.y}}/>
            </PopoverPrimitive.Anchor>
            <Popover.Content container={overlay.portal} side="bottom" align="start" sideOffset={4} size="1"
                             minWidth="200px" maxWidth="320px" onOpenAutoFocus={focus.onOpenAutoFocus} onCloseAutoFocus={focus.onCloseAutoFocus}>
                {/* 여기서 여는 창(메모·패키지 차단)은 연 요소로 포커스를 먼저 옮겨 둔다. 그래야 그 창이 닫힐 때 사라진 버블 대신 그리로 돌아간다 */}
                {selected.dccon ? (
                    <Flex gap="2">
                        <Button size="1" onClick={() => requestBlock({target: "dccon"})}>디시콘 차단</Button>
                        <Button size="1" variant="soft" color="gray"
                                onClick={() => {
                                    focus.returnFocus();
                                    close();
                                    onBlockPackage(selected);
                                }}>
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
                            {bans && <CopyRow label="갱차 갤러리" value={bans} onCopy={copy}/>}
                            {memo && <CopyRow label="메모" value={memo.text} onCopy={copy}/>}
                        </Flex>
                        <Separator size="4" my="2"/>
                        <Flex gap="2" wrap="wrap">
                            <Button size="1" color="red" variant="soft" onClick={() => requestBlock({target: "user"})}>
                                유저 차단
                            </Button>
                            <Button size="1" variant="soft" color="gray"
                                    onClick={() => {
                                        focus.returnFocus();
                                        useUiStore.getState().openMemoForSelected();
                                    }}>
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

/** 작성자를 우클릭하면 뜨는 유저 버블 (메모·차단·갤로그) */
export const BubbleHost = ({onBlockPackage}: { onBlockPackage: (target: SelectedUser) => void }) => {
    const bubble = useUiStore((s) => s.bubble);
    const selected = useUiStore((s) => s.selected);
    return bubble && selected ? <Bubble bubble={bubble} selected={selected} onBlockPackage={onBlockPackage}/> : null;
};
