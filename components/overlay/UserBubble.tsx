import {Copy} from "lucide-react";
import {useEffect, useRef, useSyncExternalStore} from "react";

import {DialogActions, ModalDialog} from "@/components/dialogs";
import {Button} from "@/components/ui/button";
import {DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Popover, PopoverContent} from "@/components/ui/popover";
import {Separator} from "@/components/ui/separator";
import {useReturnFocus} from "@/components/useReturnFocus";
import {blockingEntries} from "@/core/block";
import {banReasonsOf, databaseVersion, ipInfoOf, subscribeDatabase} from "@/core/database";
import {queryString} from "@/core/http/urls";
import {TYPE_NAMES} from "@/core/storage/items";
import type {BlockEntry, BlockType, DetectMode} from "@/core/storage/types";
import {type BlockRequestOptions, handleBlockRequest} from "@/stores/blockRequest";
import {useBlocksStore} from "@/stores/blocks";
import {useUserMemo} from "@/stores/memos";
import {type SelectedUser, useUiStore} from "@/stores/ui";
import {SAVE_FAILED} from "@/utils/error";
import {type ActivityState, useGallogActivity} from "@/components/overlay/gallogActivity";

import {overlay} from "./shadow";

/** 클릭하면 복사되는 값 한 줄. */
const CopyRow = ({label, value, onCopy}: { label: string; value: string; onCopy: (value: string) => void }) => (
    <Button variant="ghost" size="sm" className="w-full justify-between font-normal" title="클릭하면 복사됩니다." onClick={() => onCopy(value)}>
        <span className="truncate">
            <span className="text-muted-foreground">{label}</span> <strong>{value}</strong>
        </span>
        <Copy data-icon="inline-end"/>
    </Button>
);

const formatActivity = (activity: ActivityState): string | undefined => {
    if (activity === "loading") return "불러오는 중…";
    if (activity === "error") return "불러오지 못함";
    if (!activity) return undefined;
    return `${activity.article.toLocaleString()} / ${activity.comment.toLocaleString()}`;
};

const identityValue = ({uid, ip}: { uid?: string; ip?: string }): string | undefined => (uid && ip ? `${uid} (${ip})` : uid || ip);

/** 차단 규칙 하나를 해제한다. 토스트의 되돌리기 버튼으로 다시 걸 수 있다. */
const unblock = async (type: BlockType, {id, ...fields}: BlockEntry): Promise<void> => {
    const {showToast} = useUiStore.getState();
    const saveFailed = (): void => showToast(SAVE_FAILED, "error");
    try {
        await useBlocksStore.getState().removeEntry(type, id);
    } catch {
        saveFailed();
        return;
    }
    // 정규식은 한 규칙이 여러 대상을 막는다.
    const others = fields.isRegex ? " 같은 규칙에 걸린 다른 대상도 풀렸습니다." : "";
    showToast(`차단을 해제했습니다.${others}`, "info", 5000, {
        label: "되돌리기",
        run: () => void useBlocksStore.getState().addEntry(type, fields).catch(saveFailed)
    });
};

/**
 * 이 대상을 막고 있는 차단 규칙 목록. 왜 가려졌는지 보여 주고 그 자리에서 풀 수 있게 한다.
 * 허용 목록(불일치·불포함)은 이 대상이 어느 항목에도 맞지 않아 막힌 것이라, 항목을 지워도 풀리지 않고 지운 항목의 사람까지 막히므로 해제를 두지 않는다.
 */
const BlockRules = ({rules, defaults}: { rules: { type: BlockType; entry: BlockEntry }[]; defaults: Record<BlockType, DetectMode> }) => (
    <>
        <Separator/>
        <p className="text-xs text-muted-foreground">걸린 차단 규칙</p>
        <div className="flex flex-col gap-1">
            {rules.map(({type, entry}) => {
                const name = type === "DCCON" ? entry.extra || entry.content : entry.content;
                const allowList = (entry.mode ?? defaults[type]).startsWith("NOT_");
                return (
                    <div key={entry.id} className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs" title={entry.isRegex ? "정규식 — 풀면 이 규칙에 걸린 다른 대상도 함께 풀립니다." : undefined}>
                            <span className="text-muted-foreground">{TYPE_NAMES[type]}</span> {name}
                            {entry.isRegex && <span className="text-muted-foreground"> (정규식)</span>}
                            {entry.gallery && <span className="text-muted-foreground"> (이 갤러리만)</span>}
                        </span>
                        {allowList ? (
                            <span className="shrink-0 text-xs text-muted-foreground">허용 목록에 없음</span>
                        ) : (
                            <Button size="xs" variant="ghost" className="shrink-0 text-destructive"
                                    aria-label={`${TYPE_NAMES[type]} ${name} 차단 해제`}
                                    onClick={() => void unblock(type, entry)}>해제</Button>
                        )}
                    </div>
                );
            })}
        </div>
    </>
);

/** 디시콘 패키지 전체를 어떻게 차단할지 고른다. 취소하면 아무것도 차단하지 않는다. */
export const DcconPackageDialog = ({target, onClose}: { target: SelectedUser; onClose: () => void }) => {
    const choose = (dcconPackage: "bundle" | "each"): void => {
        onClose();
        void handleBlockRequest({target: "dccon", dcconPackage}, target);
    };

    return (
        <ModalDialog onClose={onClose} className="sm:max-w-[400px]">
            <DialogHeader>
                <DialogTitle>디시콘 패키지를 어떻게 차단할까요?</DialogTitle>
                <DialogDescription>
                    묶어서 차단하면 차단 목록에 한 항목으로 들어갑니다. 하나씩 차단하면 디시콘마다 항목이 생겨 따로 풀 수 있습니다.
                </DialogDescription>
            </DialogHeader>
            <DialogActions>
                <Button variant="secondary" onClick={() => choose("each")}>하나씩 차단</Button>
                <Button onClick={() => choose("bundle")}>묶어서 차단</Button>
            </DialogActions>
        </ModalDialog>
    );
};

interface BubbleProps {
    bubble: { x: number; y: number };
    selected: SelectedUser;
    onBlockPackage: (target: SelectedUser) => void;
}

/** 유저 버블. 열 때 마운트되어 연 요소(닉네임 버튼 등)를 기억했다가 닫을 때 그리로 포커스를 돌려준다. */
const Bubble = ({bubble, selected, onBlockPackage}: BubbleProps) => {
    const popup = useRef<HTMLDivElement>(null);
    const focus = useReturnFocus(popup);
    const activityState = useGallogActivity(selected.dccon ? undefined : selected.uid);
    const gallery = queryString("id");
    const memo = useUserMemo(selected, gallery);
    // 구독한 목록으로 찾아야 해제했을 때 바로 다시 계산된다.
    const entries = useBlocksStore((s) => s.entries);
    const defaults = useBlocksStore((s) => s.defaults);
    const rules = blockingEntries(selected.dccon ? {DCCON: selected.dccon} : {NICK: selected.nick, ID: selected.uid, IP: selected.ip}, gallery ?? undefined, {entries, defaults});
    // IP/밴 조회 식에 이 번호를 넣는다. 빠지면 React Compiler가 인자만 보고 메모해 DB를 읽은 뒤에도 옛 값이 남는다.
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
    // 이벤트로 보내면 차단 모듈이 꺼져 있을 때 받는 쪽이 없어 조용히 무시되므로 직접 부른다.
    const requestBlock = (options: BlockRequestOptions): void => {
        void handleBlockRequest(options, selected);
        close();
    };

    const identity = identityValue(selected);
    const ipLabel = dbVersion > 0 && selected.ip ? ipInfoOf(selected.ip)?.label : undefined;
    const bans = dbVersion > 0 && selected.uid ? banReasonsOf(selected.uid) : undefined;
    const activity = formatActivity(activityState);

    return (
        <Popover open onOpenChange={(open, details) => {
            if (open) return;
            // 닫힌 버블도 Preact가 effect 정리를 그린 뒤로 미뤄, 그동안 Base UI가 클릭·Esc를 받는다. 지금 떠 있는 버블이 아니면 손대지 않고 흘려보낸다.
            // 두면 곧바로 다시 연 버블을 여는 클릭으로 닫고, 다음 Esc(미리보기 닫기 등)를 먹는다.
            if (useUiStore.getState().bubble !== bubble) {
                details.cancel();
                details.allowPropagation();
                return;
            }
            close();
        }}>
            {/* 우클릭한 자리에 띄운다. 트리거 대신 그 점을 기준으로 놓는다. */}
            <PopoverContent ref={popup} side="bottom" align="start" sideOffset={4} className="w-auto min-w-[200px] max-w-[320px] gap-2 p-2"
                            anchor={{getBoundingClientRect: () => DOMRect.fromRect({x: bubble.x, y: bubble.y, width: 0, height: 0})}}
                            initialFocus={focus.keyboard} finalFocus={focus.finalFocus}>
                {/* 여기서 여는 창(메모·패키지 차단)은 연 요소로 포커스를 먼저 옮겨 둔다. 그래야 그 창이 닫힐 때 사라진 버블 대신 그리로 돌아간다. */}
                {selected.dccon ? (
                    <div className="flex gap-2">
                        <Button size="sm" onClick={() => requestBlock({target: "dccon"})}>디시콘 차단</Button>
                        <Button size="sm" variant="secondary"
                                onClick={() => {
                                    focus.returnFocus();
                                    close();
                                    onBlockPackage(selected);
                                }}>
                            디시콘 전체 차단
                        </Button>
                    </div>
                ) : (
                    <>
                        <div className="flex flex-col gap-1">
                            {selected.nick && <CopyRow label="닉네임" value={selected.nick} onCopy={copy}/>}
                            {identity && <CopyRow label="아이디/IP" value={identity} onCopy={copy}/>}
                            {ipLabel && <CopyRow label="IP 정보" value={ipLabel} onCopy={copy}/>}
                            {activity && <CopyRow label="글/댓글" value={activity} onCopy={copy}/>}
                            {bans && <CopyRow label="갱차 갤러리" value={bans} onCopy={copy}/>}
                            {memo && <CopyRow label="메모" value={memo.text} onCopy={copy}/>}
                        </div>
                        <Separator/>
                        <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="destructive" onClick={() => requestBlock({target: "user"})}>
                                유저 차단
                            </Button>
                            <Button size="sm" variant="secondary"
                                    onClick={() => {
                                        focus.returnFocus();
                                        useUiStore.getState().openMemo(selected);
                                    }}>
                                메모
                            </Button>
                            {selected.uid && (
                                <Button size="sm" variant="secondary" nativeButton={false}
                                        render={<a href={`https://gallog.dcinside.com/${selected.uid}`} target="_blank" rel="noreferrer" onClick={close}/>}>
                                    갤로그
                                </Button>
                            )}
                        </div>
                    </>
                )}
                {rules.length > 0 && <BlockRules rules={rules} defaults={defaults}/>}
            </PopoverContent>
        </Popover>
    );
};

/** 작성자를 우클릭하면 뜨는 유저 버블 (메모·차단·갤로그). */
export const BubbleHost = ({onBlockPackage}: { onBlockPackage: (target: SelectedUser) => void }) => {
    const bubble = useUiStore((s) => s.bubble);
    const selected = useUiStore((s) => s.selected);
    return bubble && selected ? <Bubble bubble={bubble} selected={selected} onBlockPackage={onBlockPackage}/> : null;
};
