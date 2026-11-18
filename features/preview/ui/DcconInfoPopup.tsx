import {type MouseEvent, useEffect, useState} from "react";

import {ConfirmDialog, DialogCloseButton, DialogTitle, ModalDialog} from "@/components/dialogs";
import {dcconCode, isBlockedHidden} from "@/core/block";
import {urls} from "@/core/http/urls";
import {addDcconPackage, dcconPackages, fetchDcconPackage} from "@/core/preview/request";
import {clearDcconCaches} from "@/core/preview/dccon";
import {useUiStore} from "@/stores/ui";

import {previewGallery, usePreviewStore} from "./previewStore";

const close = (): void => usePreviewStore.setState({dcconInfo: null});

/** 누른 디시콘의 정보 창을 연다 - 가린 디시콘은 공개 중에만 연다. */
export const openDcconInfo = (ev: MouseEvent<HTMLElement>): boolean => {
    const dccon = ev.target instanceof Element ? ev.target.closest<HTMLElement>(".written_dccon") : null;
    if (!dccon || isBlockedHidden(dccon)) return false;

    const code = dcconCode(dccon);
    if (code) usePreviewStore.setState({dcconInfo: code});
    return Boolean(code);
};

/** 목록의 디시콘을 우클릭하면 차단 버블을 연다 - 페이지 쪽 리스너가 받지 못하는 요소다. */
const openBlockBubble = (ev: MouseEvent<HTMLElement>): void => {
    const code = !ev.shiftKey && ev.target instanceof HTMLImageElement ? dcconCode(ev.target) : undefined;
    if (!code) return;

    ev.preventDefault();
    useUiStore.getState().openBubble({dccon: code, gallery: previewGallery()}, ev.clientX, ev.clientY);
};

/** 제작, 태그 줄 앞의 작은 딱지 (디시 정보창의 tbox). */
const Label = ({children}: { children: string }) => (
    <span className="badge badge-outline rounded-sm text-muted-foreground">{children}</span>
);

const ShopLink = ({href, children}: { href: string; children: string }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-link underline-offset-4 hover:underline">{children}</a>
);

/** 댓글, 본문의 디시콘을 눌렀을 때 그 디시콘이 든 패키지 정보를 보여 준다 (디시 '디시콘 보기' 창). */
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
            clearDcconCaches();
            setAdded(true);
            showToast("디시콘을 추가했습니다.");
        } else if (result === "not_login") {
            showToast("디시콘은 로그인한 뒤에 추가할 수 있습니다.", "warning");
        } else {
            showToast("디시콘을 추가하지 못했습니다.", "error");
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
                {info ? <img src={urls.dccon.image + info.main_img_path} alt={info.title} className="size-30 flex-none object-contain"/> : <span className="size-30 flex-none animate-pulse rounded-md bg-muted"/>}

                <div className="flex min-w-0 grow flex-col gap-2">
                    {info ? (
                        <>
                            <div className="flex items-start justify-between gap-3">
                                <span className="text-lg font-bold">{info.title}</span>
                                {!info.register && !info.residual && !added &&
                                    <button type="button" className="btn btn-primary shrink-0" disabled={sending} onClick={() => setConfirming(true)}>
                                        {sending && <span aria-hidden className="loading loading-spinner"/>}사용
                                    </button>}
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
                            <span className="h-6 w-40 animate-pulse rounded-md bg-muted"/>
                            <span className="h-[18px] w-70 animate-pulse rounded-md bg-muted"/>
                            <span className="h-[18px] w-50 animate-pulse rounded-md bg-muted"/>
                        </>
                    )}
                </div>
            </div>

            {/* 우클릭하면 차단 버블 - 목록 높이를 미리 잡아 창이 커지지 않게 한다. */}
            <div className="grid max-h-[420px] grid-cols-[repeat(auto-fill,minmax(96px,1fr))] content-start gap-2 overflow-y-auto aria-busy:h-[420px] aria-busy:overflow-hidden"
                 aria-busy={!dccon} onContextMenu={openBlockBubble}>
                {dccon
                    ? dccon.detail.map((item) => <img key={item.idx} src={urls.dccon.image + item.path} alt={item.title} title={item.title} loading="lazy" decoding="async"
                                                      className="aspect-square w-full cursor-context-menu object-contain"/>)
                    : Array.from({length: 30}, (_, index) => <span key={index} className="aspect-square w-full animate-pulse rounded-md bg-muted"/>)}
            </div>

            {/* 이 창 안에 그려야 확인 창을 누를 때 이 창이 바깥 클릭으로 닫히지 않는다. */}
            {confirming && info && (
                <ConfirmDialog title="디시콘을 추가할까요?" confirmLabel="추가"
                               onConfirm={() => void addDccon(info.package_idx)} onClose={() => setConfirming(false)}/>
            )}
        </ModalDialog>
    );
};
