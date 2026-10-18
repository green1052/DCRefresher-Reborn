import {type MouseEvent, useEffect, useState} from "react";

import {ConfirmDialog, DialogCloseButton, ModalDialog} from "@/components/dialogs";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {DialogTitle} from "@/components/ui/dialog";
import {Skeleton} from "@/components/ui/skeleton";
import {Spinner} from "@/components/ui/spinner";
import {dcconCode, isBlockedHidden} from "@/core/block";
import {urls} from "@/core/http/urls";
import {addDcconPackage, dcconPackages, fetchDcconPackage} from "@/core/preview/request";
import {useUiStore} from "@/stores/ui";

import {clearDcconListCache} from "./DcconPopup";
import {previewGallery, usePreviewStore} from "./previewStore";

const close = (): void => usePreviewStore.setState({dcconInfo: null});

/**
 * 본문·댓글에서 누른 디시콘의 정보 창을 연다. 디시콘을 눌렀으면 true.
 * 차단으로 가린 디시콘은 '가린 내용 보기' 동안이거나 흐림이 풀려 있는 동안(blurReveal)만 연다 (isBlockedHidden, 큰 이미지와 같은 기준).
 */
export const openDcconInfo = (ev: MouseEvent<HTMLElement>): boolean => {
    const dccon = ev.target instanceof Element ? ev.target.closest<HTMLElement>(".written_dccon") : null;
    if (!dccon || isBlockedHidden(dccon)) return false;

    const code = dcconCode(dccon);
    if (code) usePreviewStore.setState({dcconInfo: code});
    return Boolean(code);
};

/**
 * 패키지 목록의 디시콘을 우클릭하면 본문 디시콘처럼 차단 버블을 연다 (features/block/index.ts의 setupSelection).
 * 목록 이미지는 .written_dccon이 아니라 페이지 쪽 리스너가 받지 않는다. 주소의 no가 차단 목록에 넣는 값과 같다.
 */
const openBlockBubble = (ev: MouseEvent<HTMLElement>): void => {
    const code = !ev.shiftKey && ev.target instanceof HTMLImageElement ? dcconCode(ev.target) : undefined;
    if (!code) return;

    ev.preventDefault();
    useUiStore.getState().openBubble({dccon: code, gallery: previewGallery()}, ev.clientX, ev.clientY);
};

/** 제작·태그 줄 앞의 작은 딱지 (디시 정보창의 tbox). */
const Label = ({children}: { children: string }) => (
    <Badge variant="outline" className="rounded-sm text-muted-foreground">{children}</Badge>
);

const ShopLink = ({href, children}: { href: string; children: string }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-link underline-offset-4 hover:underline">{children}</a>
);

/** 댓글·본문의 디시콘을 눌렀을 때 그 디시콘이 든 패키지 정보를 보여 준다 (디시 '디시콘 보기' 창). */
export const DcconInfoPopup = ({code}: { code: string }) => {
    const [dccon, setDccon] = useState(() => dcconPackages.get(code) ?? null);
    const [sending, setSending] = useState(false);
    const [added, setAdded] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const bubble = useUiStore((s) => s.bubble);

    const addDccon = async (packageIdx: string | number): Promise<void> => {
        setConfirming(false);
        if (sending) return;
        setSending(true);

        const result = await addDcconPackage(packageIdx).catch((e: unknown) => {
            console.error("Dccon package add failed:", e);
            return "fail" as const;
        });
        const {showToast} = useUiStore.getState();

        if (result === "ok") {
            clearDcconListCache();
            dcconPackages.clear();
            setAdded(true);
            showToast("디시콘을 추가했습니다.");
        } else if (result === "not_login") {
            showToast("디시콘은 로그인한 뒤에 추가할 수 있습니다.", "warning");
        } else {
            showToast("디시콘 추가 중 오류가 발생했습니다.", "error");
        }
        setSending(false);
    };

    useEffect(() => {
        if (dccon) return;
        // 닫거나 다른 디시콘을 누르면 요청을 끊고 늦게 온 결과는 버린다.
        const controller = new AbortController();
        const {signal} = controller;

        void fetchDcconPackage(code, signal).then((result) => {
            dcconPackages.set(code, result);
            if (!signal.aborted) setDccon(result);
        }, () => {
            if (signal.aborted) return;
            useUiStore.getState().showToast("디시콘 정보를 불러오지 못했습니다.", "error");
            close();
        });

        return () => controller.abort();
    }, [code]);

    const info = dccon?.info;

    return (
        // 우클릭 버블은 이 창 밖(components/overlay/UserBubble.tsx)에 뜨므로, 버블이 떠 있는 동안은 바깥 클릭으로 닫지 않는다.
        <ModalDialog onClose={close} className="sm:max-w-[600px]" focusOnOpen="keyboard" disablePointerDismissal={bubble !== null}>
            <div className="flex items-center justify-between">
                <DialogTitle>디시콘 정보</DialogTitle>
                <DialogCloseButton/>
            </div>

            <div className="flex gap-4 rounded-lg bg-muted/50 p-4">
                {info ? <img src={urls.dccon.image + info.main_img_path} alt={info.title} className="size-30 flex-none object-contain"/> : <Skeleton className="size-30 flex-none"/>}

                <div className="flex min-w-0 grow flex-col gap-2">
                    {info ? (
                        <>
                            <div className="flex items-start justify-between gap-3">
                                <span className="text-lg font-bold">{info.title}</span>
                                {!info.register && !info.residual && !added &&
                                    <Button className="shrink-0" disabled={sending} onClick={() => setConfirming(true)}>
                                        {sending && <Spinner aria-hidden data-icon="inline-start"/>}사용
                                    </Button>}
                            </div>
                            {info.description && <p>{info.description}</p>}
                            <div className="flex flex-wrap items-center gap-2">
                                <Label>제작</Label>
                                <ShopLink href={`${urls.dccon.shop}/nick_name/${encodeURIComponent(info.seller_name)}`}>{info.seller_name}</ShopLink>
                                <span className="text-muted-foreground">{info.reg_date_short}</span>
                            </div>
                            {dccon.tags.length > 0 && (
                                <div className="flex flex-wrap items-center gap-2">
                                    <Label>태그</Label>
                                    {dccon.tags.map(({tag}) => (
                                        <ShopLink key={tag} href={`${urls.dccon.shop}/tags/${encodeURIComponent(tag)}`}>{tag}</ShopLink>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <Skeleton className="h-6 w-40"/>
                            <Skeleton className="h-[18px] w-70"/>
                            <Skeleton className="h-[18px] w-50"/>
                        </>
                    )}
                </div>
            </div>

            {/* 우클릭하면 차단 버블이 뜬다 (openBlockBubble). 목록은 최대 높이만 있어 불러오는 동안 그 높이로 잡아 두어야
                다 불러왔을 때 창이 커지지 않는다. 스켈레톤은 넘치도록 깔고 스크롤바가 생기지 않게 자른다. */}
            <div className="grid max-h-[420px] grid-cols-[repeat(auto-fill,minmax(96px,1fr))] content-start gap-2 overflow-y-auto aria-busy:h-[420px] aria-busy:overflow-hidden"
                 aria-busy={!dccon} onContextMenu={openBlockBubble}>
                {dccon
                    ? dccon.detail.map((item) => <img key={item.idx} src={urls.dccon.image + item.path} alt={item.title} title={item.title} loading="lazy" decoding="async"
                                                      className="aspect-square w-full cursor-context-menu object-contain"/>)
                    : Array.from({length: 30}, (_, index) => <Skeleton key={index} className="aspect-square w-full"/>)}
            </div>

            {/* 이 창 안에 그려야 확인 창을 누를 때 이 창이 바깥 클릭으로 닫히지 않는다. */}
            {confirming && info && (
                <ConfirmDialog title="디시콘을 추가할까요?" confirmLabel="추가"
                               onConfirm={() => void addDccon(info.package_idx)} onClose={() => setConfirming(false)}/>
            )}
        </ModalDialog>
    );
};
