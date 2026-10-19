import {Ban, ExternalLink, NotebookPen, Search} from "lucide-react";
import {type ComponentProps, useEffect, useRef, useState, useSyncExternalStore} from "react";

import {DialogActions, ModalDialog} from "@/components/dialogs";
import {Button} from "@/components/ui/button";
import {DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Popover, PopoverContent} from "@/components/ui/popover";
import {Separator} from "@/components/ui/separator";
import {Skeleton} from "@/components/ui/skeleton";
import {useReturnFocus} from "@/components/useReturnFocus";
import {blockingEntries} from "@/core/block";
import {banReasonsOf, databaseVersion, ipInfoOf, onDatabaseChange, subscribeDatabase} from "@/core/database";
import {urls} from "@/core/http/urls";
import {getModuleApi} from "@/core/module/registry";
import {dcconPackages, fetchDcconPackage} from "@/core/preview/request";
import {TYPE_NAMES} from "@/core/storage/items";
import type {BlockEntry, BlockType, DetectMode} from "@/core/storage/types";
import {type BlockRequestOptions, handleBlockRequest} from "@/stores/blockRequest";
import {blockLabel, useBlocksStore} from "@/stores/blocks";
import {useUserMemo} from "@/stores/memos";
import {copyWithToast, type SelectedUser, selectedGallery, useUiStore} from "@/stores/ui";
import {SAVE_FAILED} from "@/utils/error";
import {type ActivityState, useGallogActivity} from "@/components/overlay/gallogActivity";
import {cn} from "cn";

import {overlay} from "./shadow";

/** 버블 메뉴 한 줄. 우클릭 메뉴처럼 왼쪽에 맞춰 세로로 쌓는다. danger는 차단처럼 되돌리기 번거로운 동작이다. */
const MenuItem = ({danger, className, ...props}: ComponentProps<typeof Button> & { danger?: boolean }) => (
    <Button variant="ghost" size="sm"
            className={cn("w-full cursor-pointer justify-start font-normal", danger && "text-destructive hover:bg-destructive/10 hover:text-destructive", className)}
            {...props}/>
);

/**
 * 디시콘 버블 맨 위의 패키지 이름과 설명. 누르면 디시콘 정보 창을 연다. 디시콘 하나의 이름("33" 등)은 뜻이 없는 것이 많아 쓰지 않는다.
 * 정보 창과 같은 캐시(dcconPackages)를 써 이어서 열어도 다시 받지 않는다. 받지 못하면 이름 없이 열기만 둔다.
 */
const DcconSummary = ({code, onOpen}: { code: string; onOpen: () => void }) => {
    const [dccon, setDccon] = useState(() => dcconPackages.get(code) ?? null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (dccon) return;
        const controller = new AbortController();
        void fetchDcconPackage(code, controller.signal).then((result) => {
            dcconPackages.set(code, result);
            if (!controller.signal.aborted) setDccon(result);
        }, () => !controller.signal.aborted && setFailed(true));
        return () => controller.abort();
    }, [code]);

    return (
        <MenuItem title="디시콘 정보 보기" className="h-auto items-start gap-2 py-1.5 whitespace-normal" onClick={onOpen}>
            {dccon ? (
                <>
                    <img src={urls.dccon.image + dccon.info.main_img_path} alt="" className="size-10 flex-none rounded-sm object-contain"/>
                    <span className="flex min-w-0 flex-col items-start gap-0.5">
                        <strong>{dccon.info.title}</strong>
                        {dccon.info.description && <span className="line-clamp-2 text-left text-xs text-muted-foreground">{dccon.info.description}</span>}
                    </span>
                </>
            ) : failed ? (
                <span>디시콘 정보</span>
            ) : (
                <>
                    <Skeleton className="size-10 flex-none"/>
                    <span className="flex flex-col gap-1">
                        <Skeleton className="h-4 w-24"/>
                        <Skeleton className="h-3 w-40"/>
                    </span>
                </>
            )}
        </MenuItem>
    );
};

/** 클릭하면 복사되는 값 한 줄. 라벨 폭을 맞춰 값이 한 줄로 늘어서게 하고, 긴 값(IP 후보 등)은 띄어쓰기에서 다음 줄로 넘긴다. onSearch가 있으면 오른쪽에 그 값으로 글을 찾는 버튼을 둔다. */
const CopyRow = ({label, value, onCopy, onSearch}: { label: string; value: string; onCopy: (value: string) => void; onSearch?: () => void }) => (
    <div className="flex items-center">
        <MenuItem className="h-auto min-h-8 min-w-0 flex-1 py-1.5 whitespace-normal" title="클릭하면 복사됩니다." onClick={() => onCopy(value)}>
            <span className="w-18 shrink-0 text-left text-muted-foreground">{label}</span>{" "}
            <strong className="min-w-0 text-left break-keep wrap-anywhere">{value}</strong>
        </MenuItem>
        {onSearch && (
            <Button variant="ghost" size="icon-sm" className="shrink-0 cursor-pointer text-muted-foreground" aria-label={`${label}(으)로 글 검색`} title={`${label}(으)로 글 검색`}
                    onClick={onSearch}>
                <Search/>
            </Button>
        )}
    </div>
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

type BlockRule = { type: BlockType; entry: BlockEntry };

/**
 * 이 대상을 막고 있는 차단 규칙 목록. 왜 가려졌는지 보여 주고 그 자리에서 풀 수 있게 한다.
 * 허용 목록(불일치·불포함)은 이 대상이 어느 항목에도 맞지 않아 막힌 것이라, 항목을 지워도 풀리지 않고 지운 항목의 사람까지 막히므로 해제를 두지 않는다.
 * 허용 목록은 맞지 않은 항목 전부가 넘어오므로 유형마다 한 줄로 줄인다. 항목마다 그리면 버블이 화면을 넘고(스크롤하면 닫힌다) 해제 버튼이 밀려난다.
 */
const BlockRules = ({rules, defaults}: { rules: BlockRule[]; defaults: Record<BlockType, DetectMode> }) => {
    const isAllowList = ({type, entry}: BlockRule): boolean => (entry.mode ?? defaults[type]).startsWith("NOT_");
    const hits = rules.filter((rule) => !isAllowList(rule));
    const allowLists = Map.groupBy(rules.filter(isAllowList), ({type}) => type);
    return (
        <>
            <Separator/>
            <p className="text-xs text-muted-foreground">걸린 차단 규칙</p>
            <div className="flex flex-col gap-1">
                {hits.map(({type, entry}) => {
                    const name = blockLabel(type, entry);
                    return (
                        <div key={entry.id} className="flex items-center justify-between gap-2">
                            <span className="truncate text-xs" title={entry.isRegex ? "정규식 — 풀면 이 규칙에 걸린 다른 대상도 함께 풀립니다." : undefined}>
                                <span className="text-muted-foreground">{TYPE_NAMES[type]}</span> {name}
                                {entry.isRegex && <span className="text-muted-foreground"> (정규식)</span>}
                                {entry.gallery && <span className="text-muted-foreground"> (이 갤러리만)</span>}
                            </span>
                            <Button size="xs" variant="ghost" className="shrink-0 text-destructive"
                                    aria-label={`${TYPE_NAMES[type]} ${name} 차단 해제`}
                                    onClick={() => void unblock(type, entry)}>해제</Button>
                        </div>
                    );
                })}
                {Array.from(allowLists, ([type, entries]) => (
                    <span key={type} className="text-xs">
                        <span className="text-muted-foreground">{TYPE_NAMES[type]}</span> 허용 목록({entries.length}개)에 없음
                    </span>
                ))}
            </div>
        </>
    );
};

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

/** 버블이 여는 창. 창은 버블 밖(ContentRoot)에 그려 버블이 닫혀도 남는다. */
interface BubbleActions {
    onBlockPackage: (target: SelectedUser) => void;
    /** 디시콘 코드로 디시콘 정보 창(미리보기의 DcconInfoPopup)을 연다. */
    onDcconInfo: (code: string) => void;
}

interface BubbleProps extends BubbleActions {
    bubble: { x: number; y: number };
    selected: SelectedUser;
}

/** 유저 버블. 열 때 마운트되어 닫을 때 연 요소로 포커스를 돌려준다 (useReturnFocus). */
const Bubble = ({bubble, selected, onBlockPackage, onDcconInfo}: BubbleProps) => {
    const popup = useRef<HTMLDivElement>(null);
    const focus = useReturnFocus(popup);
    const activityState = useGallogActivity(selected.dccon ? undefined : selected.uid);
    const gallery = selectedGallery(selected.gallery);
    const memo = useUserMemo(selected, gallery);
    // 구독한 목록으로 찾아야 해제했을 때 바로 다시 계산된다.
    const entries = useBlocksStore((s) => s.entries);
    const defaults = useBlocksStore((s) => s.defaults);
    const rules = blockingEntries(selected.dccon ? {DCCON: selected.dccon} : {NICK: selected.nick, ID: selected.uid, IP: selected.ip}, gallery ?? undefined, {entries, defaults});
    // DB를 읽을 때마다 오르는 번호를 구독해 다시 그린다. 0이면 아직 읽지 않아 IP·밴을 찾지 않는다.
    // 디시콘 버블은 IP·밴을 그리지 않으므로 읽기를 시작하지 않는다(onDatabaseChange).
    const dbVersion = useSyncExternalStore(selected.dccon ? onDatabaseChange : subscribeDatabase, databaseVersion);

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
        void copyWithToast(value);
    };
    // 이벤트로 보내면 차단 모듈이 꺼져 있을 때 받는 쪽이 없어 조용히 무시되므로 직접 부른다.
    const requestBlock = (options: BlockRequestOptions): void => {
        void handleBlockRequest(options, selected);
        close();
    };

    const identity = identityValue(selected);
    // 검색 모듈이 이 페이지에서 돌 때만 (아이디·IP 거르기를 그 모듈이 한다).
    const searchApi = getModuleApi("search");
    const searchBy = (by: "nick" | "identity"): (() => void) | undefined => searchApi && (() => {
        close();
        searchApi.searchUserPosts(selected, by);
    });
    const ipLabel = dbVersion > 0 && selected.ip ? ipInfoOf(selected.ip)?.label : undefined;
    const bans = dbVersion > 0 && selected.uid ? banReasonsOf(selected.uid) : undefined;
    const activity = formatActivity(activityState);

    return (
        <Popover open onOpenChange={(open, details) => {
            if (open) return;
            // Preact가 effect 정리를 그린 뒤로 미뤄 닫힌 버블도 잠시 클릭·Esc를 받는다. 지금 버블이 아니면 흘려보낸다.
            // 받으면 곧바로 다시 연 버블을 그 클릭으로 닫고, 다음 Esc(미리보기 닫기 등)를 먹는다.
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
                            initialFocus={focus.keyboard} finalFocus={focus.finalFocus}
                            aria-label={selected.dccon ? "디시콘 메뉴" : `${selected.nick || identity || "사용자"} 메뉴`}>
                {/* 여기서 여는 창(메모·패키지 차단)은 연 요소로 포커스를 먼저 옮겨 둔다. 그래야 그 창이 닫힐 때 사라진 버블 대신 그리로 돌아간다. */}
                {selected.dccon ? (
                    <>
                        {/* 버블이 떠 있는 채로 다른 디시콘을 우클릭해도 그 디시콘의 정보를 새로 받게 코드로 다시 만든다. */}
                        <DcconSummary key={selected.dccon} code={selected.dccon} onOpen={() => {
                            focus.returnFocus();
                            close();
                            onDcconInfo(selected.dccon!);
                        }}/>
                        <Separator/>
                        <div className="flex flex-col">
                            <MenuItem danger onClick={() => requestBlock({target: "dccon"})}><Ban/> 이 디시콘 차단</MenuItem>
                            <MenuItem danger title="이 디시콘이 든 패키지를 모두 가립니다."
                                      onClick={() => {
                                          focus.returnFocus();
                                          close();
                                          onBlockPackage(selected);
                                      }}>
                                <Ban/> 전체 차단
                            </MenuItem>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="flex flex-col">
                            {selected.nick && <CopyRow label="닉네임" value={selected.nick} onCopy={copy} onSearch={searchBy("nick")}/>}
                            {identity && <CopyRow label="아이디/IP" value={identity} onCopy={copy} onSearch={searchBy("identity")}/>}
                            {ipLabel && <CopyRow label="IP 정보" value={ipLabel} onCopy={copy}/>}
                            {activity && <CopyRow label="글/댓글" value={activity} onCopy={copy}/>}
                            {bans && <CopyRow label="갱차 갤러리" value={bans} onCopy={copy}/>}
                            {memo && <CopyRow label="메모" value={memo.text} onCopy={copy}/>}
                        </div>
                        <Separator/>
                        <div className="flex flex-col">
                            <MenuItem danger onClick={() => requestBlock({target: "user"})}><Ban/> 유저 차단</MenuItem>
                            {gallery && (
                                <MenuItem danger title={`${gallery} 갤러리에서만 가립니다.`} onClick={() => requestBlock({target: "user", gallery})}>
                                    <Ban/> 이 갤러리에서만 차단
                                </MenuItem>
                            )}
                        </div>
                        <Separator/>
                        <div className="flex flex-col">
                            <MenuItem onClick={() => {
                                focus.returnFocus();
                                useUiStore.getState().openMemo(selected);
                            }}>
                                <NotebookPen/> 메모
                            </MenuItem>
                            {selected.uid && (
                                <MenuItem nativeButton={false}
                                          render={<a href={`https://gallog.dcinside.com/${selected.uid}`} target="_blank" rel="noreferrer" onClick={close}/>}>
                                    <ExternalLink/> 갤로그
                                </MenuItem>
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
export const BubbleHost = (actions: BubbleActions) => {
    const bubble = useUiStore((s) => s.bubble);
    const selected = useUiStore((s) => s.selected);
    return bubble && selected ? <Bubble bubble={bubble} selected={selected} {...actions}/> : null;
};
