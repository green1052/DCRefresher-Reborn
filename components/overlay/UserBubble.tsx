import {Ban, ExternalLink, NotebookPen, Search} from "lucide-preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { useSyncExternalStore } from "@/utils/useSyncExternalStore";
import { type ComponentProps } from "preact";
import { createPortal } from "preact";

import {DialogActions, DialogDescription, DialogHeader, DialogTitle, ModalDialog, firstFocusable} from "@/components/dialogs";
import {useReturnFocus} from "@/components/useReturnFocus";
import {blockingEntries} from "@/core/block";
import {banReasonsOf, databaseVersion, ipInfoOf, onDatabaseChange, subscribeDatabase} from "@/core/database";
import {urls} from "@/core/http/urls";
import {getModuleApi} from "@/core/module/registry";
import {useRunningModuleSettings} from "@/core/module/useModuleSettings";
import {dcconPackages, fetchDcconPackage} from "@/core/preview/request";
import {TYPE_NAMES} from "@/core/storage/items";
import type {BlockEntry, BlockType, DetectMode} from "@/core/storage/types";
import {type BlockRequestOptions, handleBlockRequest} from "@/stores/blockRequest";
import {blockLabel, useBlocksStore} from "@/stores/blocks";
import {useUserMemo} from "@/stores/memos";
import {copyText, type SelectedUser, selectedGallery, useUiStore} from "@/stores/ui";
import {SAVE_FAILED} from "@/utils/error";
import {type ActivityState, useGallogActivity} from "@/components/overlay/gallogActivity";
import {cn} from "cn";

import {overlay} from "./shadow";

const MENU_ITEM = "btn btn-ghost btn-sm w-full cursor-pointer justify-start font-normal [&_svg:not([class*='size-'])]:size-4";

const MenuItem = ({danger, className, ...props}: ComponentProps<"button"> & { danger?: boolean }) => (
    <button type="button"
            className={cn(MENU_ITEM, danger && "text-error hover:bg-error/10 hover:text-error", className)}
            {...props}/>
);

const Separator = () => <div role="none" className="divider m-0"/>;

// 디시콘 하나의 이름은 뜻이 없는 경우가 많아 패키지 정보를 쓴다 - 정보 창과 같은 캐시(dcconPackages)를 공유해 다시 받지 않는다.
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
                        {dccon.info.description && <span className="line-clamp-2 text-left text-xs text-base-content/60">{dccon.info.description}</span>}
                    </span>
                </>
            ) : failed ? (
                <span>디시콘 정보</span>
            ) : (
                <>
                    <span className="size-10 flex-none skeleton"/>
                    <span className="flex flex-col gap-1">
                        <span className="h-4 w-24 skeleton"/>
                        <span className="h-3 w-40 skeleton"/>
                    </span>
                </>
            )}
        </MenuItem>
    );
};

const CopyRow = ({label, value, onCopy, onSearch, color, valueClassName}: {
    label: string;
    value: string;
    onCopy: (value: string) => void;
    onSearch?: () => void;
    color?: string;
    valueClassName?: string;
}) => (
    <div className="flex items-center">
        <MenuItem className="h-auto min-h-8 min-w-0 flex-1 py-1.5 whitespace-normal" title="클릭하면 복사됩니다." onClick={() => onCopy(value)}>
            <span className="w-18 shrink-0 text-left text-base-content/60">{label}</span>{" "}
            <strong className={cn("min-w-0 text-left break-keep wrap-anywhere", valueClassName)} style={{color}}>{value}</strong>
        </MenuItem>
        {onSearch && (
            <button type="button" className="btn btn-ghost btn-square btn-sm shrink-0 cursor-pointer text-base-content/60"
                    aria-label={`${label}(으)로 글 검색`} title={`${label}(으)로 글 검색`}
                    onClick={onSearch}>
                <Search className="size-4"/>
            </button>
        )}
    </div>
);

const formatActivity = (activity: ActivityState): string | undefined => {
    if (activity === "loading") return "불러오는 중...";
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

// 허용 목록은 이 대상이 어느 항목에도 맞지 않아 막힌 것이라 항목을 지워도 안 풀려 해제를 두지 않는다.
const BlockRules = ({rules, defaults}: { rules: BlockRule[]; defaults: Record<BlockType, DetectMode> }) => {
    const isAllowList = ({type, entry}: BlockRule): boolean => (entry.mode ?? defaults[type]).startsWith("NOT_");
    const hits = rules.filter((rule) => !isAllowList(rule));
    const allowLists = Map.groupBy(rules.filter(isAllowList), ({type}) => type);
    return (
        <>
            <Separator/>
            <p className="text-xs text-base-content/60">걸린 차단 규칙</p>
            <div className="flex flex-col gap-1">
                {hits.map(({type, entry}) => {
                    const name = blockLabel(entry);
                    return (
                        <div key={entry.id} className="flex items-center justify-between gap-2">
                            <span className="truncate text-xs" title={entry.isRegex ? "정규식 - 풀면 이 규칙에 걸린 다른 대상도 함께 풀립니다." : undefined}>
                                <span className="text-base-content/60">{TYPE_NAMES[type]}</span> {name}
                                {entry.isRegex && <span className="text-base-content/60"> (정규식)</span>}
                                {entry.gallery && <span className="text-base-content/60"> (이 갤러리만)</span>}
                            </span>
                            <button type="button" className="btn btn-ghost btn-xs shrink-0 cursor-pointer text-error"
                                    aria-label={`${TYPE_NAMES[type]} ${name} 차단 해제`}
                                    onClick={() => void unblock(type, entry)}>해제</button>
                        </div>
                    );
                })}
                {Array.from(allowLists, ([type, entries]) => (
                    <span key={type} className="text-xs">
                        <span className="text-base-content/60">{TYPE_NAMES[type]}</span> 허용 목록({entries.length}개)에 없음
                    </span>
                ))}
            </div>
        </>
    );
};

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
                <button type="button" className="btn" onClick={() => choose("each")}>하나씩 차단</button>
                <button type="button" className="btn btn-primary" onClick={() => choose("bundle")}>묶어서 차단</button>
            </DialogActions>
        </ModalDialog>
    );
};

/** 버블이 여는 창. 창은 버블 밖(ContentRoot)에 그려 버블이 닫혀도 남는다. */
interface BubbleActions {
    onBlockPackage: (target: SelectedUser) => void;
    onDcconInfo: (code: string) => void;
}

interface BubbleProps extends BubbleActions {
    bubble: { x: number; y: number };
    selected: SelectedUser;
}

/** 버블이 보여 줄 데이터 - 스토어 구독과 파생값을 모은다. */
const useBubbleData = (selected: SelectedUser) => {
    const activityState = useGallogActivity(selected.dccon ? undefined : selected.uid);
    const gallery = selectedGallery(selected.gallery);
    const memo = useUserMemo(selected, gallery);
    // 구독한 목록으로 찾아야 해제했을 때 바로 다시 계산된다.
    const entries = useBlocksStore((s) => s.entries);
    const defaults = useBlocksStore((s) => s.defaults);
    const rules = blockingEntries(selected.dccon ? {DCCON: selected.dccon} : {NICK: selected.nick, ID: selected.uid, IP: selected.ip}, gallery ?? undefined, {entries, defaults});
    // DB를 읽을 때마다 오르는 번호를 구독해 다시 그린다 (0이면 아직 읽지 않아 IP, 밴을 찾지 않는다).
    const dbVersion = useSyncExternalStore(selected.dccon ? onDatabaseChange : subscribeDatabase, databaseVersion);
    const ipInfo = dbVersion > 0 && selected.ip ? ipInfoOf(selected.ip) : undefined;
    // 배지와 같은 색. 유저 정보 모듈이 꺼져 있거나 색을 비웠으면 미리보기(features/preview/ui/UserCard.tsx)처럼 파랑이다.
    const userinfo = useRunningModuleSettings("userinfo");
    const ipColor = ipInfo ? userinfo?.[`${ipInfo.category}Color`] : undefined;
    const bans = dbVersion > 0 && selected.uid ? banReasonsOf(selected.uid) : undefined;
    return {gallery, defaults, rules, memo, ipInfo, ipColor, bans, activity: formatActivity(activityState)};
};

const Bubble = ({bubble, selected, onBlockPackage, onDcconInfo}: BubbleProps) => {
    const popup = useRef<HTMLDivElement>(null);
    const focus = useReturnFocus(popup);
    const {gallery, defaults, rules, memo, ipInfo, ipColor, bans, activity} = useBubbleData(selected);

    // 창을 우클릭한 자리 아래에 놓고, 화면을 넘으면 안으로 접는다. 그리기 전에 계산해 첫 프레임부터 제자리에 둔다.
    useLayoutEffect(() => {
        const el = popup.current;
        if (!el) return;
        const left = Math.min(Math.max(8, bubble.x), window.innerWidth - el.offsetWidth - 8);
        const below = bubble.y + 4;
        const top = below + el.offsetHeight > window.innerHeight - 8 ? Math.max(8, bubble.y - 4 - el.offsetHeight) : below;
        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
    });

    // 키보드로 열었을 때만 창 안으로 포커스를 옮긴다 (initialFocus). 마우스로 열었으면 그 자리에 둔다.
    useLayoutEffect(() => {
        if (focus.keyboard) firstFocusable(popup.current!)?.focus();
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        const options = {capture: true, signal: controller.signal};
        // 창은 화면 좌표에 붙어 있어 스크롤을 따라가지 못하므로 스크롤하면 닫는다 - 미리보기 스크롤은 shadow 밖으로 이벤트가 안 나가 루트에서도 잡는다.
        const onScroll = (): void => useUiStore.getState().closeBubble();
        window.addEventListener("scroll", onScroll, options);
        overlay.portal?.getRootNode().addEventListener("scroll", onScroll, options);
        // 닫는 도중 남은 클릭, Esc은 지금 버블이 아니면 무시한다 (다시 연 버블을 그 클릭으로 닫지 않게).
        const stillCurrent = (): boolean => useUiStore.getState().bubble === bubble;
        const onKeyDown = (ev: KeyboardEvent): void => {
            if (ev.key !== "Escape") return;
            // 모달 창이 열려 있으면 그 창이 Esc를 받는다(native dialog의 cancel).
            if (overlay.portal?.querySelector("dialog[open]")) return;
            if (!stillCurrent()) return;
            ev.stopPropagation();
            useUiStore.getState().closeBubble();
        };
        window.addEventListener("keydown", onKeyDown, options);
        // 창 밖을 누르면 닫는다. 다른 대상을 우클릭하면 버블이 이미 바뀌어 있어 그냥 둔다.
        const onPointerDown = (ev: PointerEvent): void => {
            // 창 밖 리스너(window)에는 shadow root 안을 눌러도 대상이 호스트(refresher-root)로 바뀌어 오므로 composedPath로 안팎을 가린다.
            if (ev.composedPath().includes(popup.current!)) return;
            if (!stillCurrent()) return;
            useUiStore.getState().closeBubble();
        };
        window.addEventListener("pointerdown", onPointerDown, options);
        return () => controller.abort();
    }, [bubble]);

    const close = (): void => useUiStore.getState().closeBubble();
    const copy = (value: string): void => {
        close();
        void copyText(value, "복사했습니다.", "복사하지 못했습니다.");
    };
    // 이벤트로 보내면 차단 모듈이 꺼져 있을 때 받는 쪽이 없어 조용히 무시되므로 직접 부른다.
    const requestBlock = (options: BlockRequestOptions): void => {
        void handleBlockRequest(options, selected);
        close();
    };

    const identity = identityValue(selected);
    // 검색 모듈이 이 페이지에서 돌 때만 (아이디, IP 거르기를 그 모듈이 한다).
    const searchApi = getModuleApi("search");
    const searchBy = (by: "nick" | "identity"): (() => void) | undefined => searchApi && (() => {
        close();
        searchApi.searchUserPosts(selected, by);
    });

    const content = (
        // fixed 창을 overlay.portal(섀도 루트)에 그린다 - transform이나 clip을 쓰는 문서 흐름과 상관없이 화면에 붙는다.
        <div ref={popup} data-slot="popover-content" role="dialog"
             aria-label={selected.dccon ? "디시콘 메뉴" : `${selected.nick || identity || "사용자"} 메뉴`}
             style={{left: `${bubble.x}px`, top: `${bubble.y + 4}px`}}
             className="fixed isolate z-50 flex min-w-[200px] max-w-[320px] flex-col gap-2 rounded-md bg-base-100 p-2 text-sm text-base-content shadow-md ring-1 ring-base-content/10 outline-none duration-100 animate-in fade-in-0 zoom-in-95">
            {/* 창이 닫힐 때 사라진 버블 대신 연 요소로 돌아오게 먼저 포커스를 옮겨 둔다. */}
            {selected.dccon ? (
                <>
                    {/* 다른 디시콘을 우클릭해도 새로 받게 코드로 다시 만든다. */}
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
                        {ipInfo && <CopyRow label="IP 정보" value={ipInfo.label} onCopy={copy} color={ipColor} valueClassName={cn(!ipColor && "text-blue-600 dark:text-blue-400")}/>}
                        {activity && <CopyRow label="글/댓글" value={activity} onCopy={copy}/>}
                        {bans && <CopyRow label="갱차 갤러리" value={bans} onCopy={copy}/>}
                        {memo && <CopyRow label="메모" value={memo.text} onCopy={copy} color={memo.color || undefined}/>}
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
                            <a className={MENU_ITEM} href={`https://gallog.dcinside.com/${selected.uid}`} target="_blank" rel="noreferrer" onClick={close}>
                                <ExternalLink/> 갤로그
                            </a>
                        )}
                    </div>
                </>
            )}
            {rules.length > 0 && <BlockRules rules={rules} defaults={defaults}/>}
        </div>
    );
    return overlay.portal ? createPortal(content, overlay.portal) : content;
};

export const BubbleHost = (actions: BubbleActions) => {
    const bubble = useUiStore((s) => s.bubble);
    const selected = useUiStore((s) => s.selected);
    return bubble && selected ? <Bubble bubble={bubble} selected={selected} {...actions}/> : null;
};
