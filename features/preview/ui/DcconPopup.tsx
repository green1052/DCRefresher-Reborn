import {cn} from "cn";
import {useEffect, useRef, useState} from "react";

import {DialogCloseButton, DialogTitle, ModalDialog} from "@/components/dialogs";
import {FOCUS_RING} from "@/components/focusRing";
import {rovingKeyDown} from "@/components/roving";
import {fetchDcconList} from "@/core/preview/request";
import {cachedDcconList, setCachedDcconList} from "@/core/preview/dccon";
import type {DcinsideDccon} from "@/core/preview/types";
import {useUiStore} from "@/stores/ui";
import {smoothScroll} from "@/utils/dom";

interface DcconPopupProps {
    onSelect: (dccons: DcinsideDccon[], bigDccon: boolean) => void;
    onClose: () => void;
}

export const DcconPopup = ({onSelect, onClose}: DcconPopupProps) => {
    const cached = cachedDcconList();
    const [packages, setPackages] = useState(() => cached ?? []);
    // 고른 패키지. 고르기 전에는 첫 패키지다.
    const [activeIdx, setActiveIdx] = useState<string>();
    const [doubleDccon, setDoubleDccon] = useState(false);
    const [bigDccon, setBigDccon] = useState(false);
    const [selected, setSelected] = useState<DcinsideDccon[]>([]);
    // 목록은 비어 있지 않을 때만 채운다. 비었거나 받지 못하면 창을 닫는다.
    const loading = packages.length === 0;
    const active = packages.find((pack) => pack.package_idx === activeIdx) ?? packages[0];

    useEffect(() => {
        if (!loading) return;
        // 닫으면 남은 쪽 요청을 끊고 늦게 온 결과는 버린다. onClose는 새로 연 창도 닫으므로 늦게 온 실패가 다시 연 창을 닫으면 안 된다.
        const controller = new AbortController();
        const {signal} = controller;

        void fetchDcconList(signal).then((result) => {
            if (signal.aborted) return;
            // 가진 디시콘이 없으면 빈 목록이 온다. 빈 창을 띄우지 않고 알린다.
            if (typeof result === "string" || result.length === 0) {
                const notLogin = result === "not_login";
                useUiStore.getState().showToast(notLogin ? "디시콘은 로그인한 뒤에 쓸 수 있습니다." : "사용 가능한 디시콘이 없습니다.", notLogin ? "warning" : "error");
                onClose();
                return;
            }

            setCachedDcconList(result);
            setPackages(result);
        }, () => {
            if (signal.aborted) return;
            useUiStore.getState().showToast("디시콘을 불러오지 못했습니다.", "error");
            onClose();
        });

        return () => controller.abort();
    }, []);

    // 휠로 굴러갈 곳. 굴리는 동안 휠이 이어지면 지금 위치가 아니라 여기에 더해야 빠르게 굴려도 덜 가지 않는다. 다 굴러가면 비운다.
    const wheelTarget = useRef<number | null>(null);
    const strip = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = strip.current;
        if (!el) return;
        // React의 onWheel은 수동(passive) 리스너라 preventDefault가 안 먹는다. 페이지가 함께 굴러가지 않게 네이티브로 단다.
        const onWheel = (ev: WheelEvent): void => {
            if (ev.shiftKey || ev.ctrlKey || Math.abs(ev.deltaY) <= Math.abs(ev.deltaX) || el.scrollWidth <= el.clientWidth) return;
            ev.preventDefault();
            const left = Math.min(Math.max((wheelTarget.current ?? el.scrollLeft) + ev.deltaY, 0), el.scrollWidth - el.clientWidth);
            wheelTarget.current = left;
            el.scrollTo({left, behavior: smoothScroll()});
        };
        el.addEventListener("wheel", onWheel, {passive: false});
        return () => el.removeEventListener("wheel", onWheel);
    }, []);

    const clickDccon = (dccon: DcinsideDccon): void => {
        const next = doubleDccon ? [...selected, dccon] : [dccon];
        if (!doubleDccon || next.length === 2) onSelect(next, bigDccon);
        else setSelected(next);
    };

    return (
        <ModalDialog onClose={onClose} className="sm:max-w-140" focusOnOpen="keyboard">
            <div className="flex items-center justify-between">
                <DialogTitle>디시콘</DialogTitle>
                {/* 오른쪽 위 닫기 단추(절대 위치) 자리를 비워 둔다. */}
                <div className="flex items-center gap-4 pr-9">
                    <label className="flex items-center gap-3">
                        <span className="text-sm leading-snug font-normal">더블콘</span>
                        <input type="checkbox" role="switch" className="toggle toggle-sm" checked={doubleDccon} onChange={(ev) => {
                            setDoubleDccon(ev.target.checked);
                            setSelected([]);
                        }}/>
                    </label>
                    <label className="flex items-center gap-3">
                        <span className="text-sm leading-snug font-normal">대왕콘</span>
                        <input type="checkbox" role="switch" className="toggle toggle-sm" checked={bigDccon} onChange={(ev) => setBigDccon(ev.target.checked)}/>
                    </label>
                    <DialogCloseButton/>
                </div>
            </div>

            {doubleDccon && selected.length > 0 && (
                <div className="flex items-center gap-2">
                    <img src={selected[0]!.list_img} alt={selected[0]!.title} width={32} height={32}/>
                    <span className="flex-1 text-muted-foreground">더블콘 {selected.length}/2 - 하나만 더 선택</span>
                    <button type="button" className="btn btn-xs btn-secondary" onClick={() => setSelected([])}>초기화</button>
                </div>
            )}

            {/* 스켈레톤은 넘치게 깔고 잘라 꽉 찬 목록처럼 보인다. 세로 휠도 옆으로 넘기므로 스크롤바는 숨긴다. */}
            <div ref={strip} role="group" aria-label="디시콘 패키지" className="flex gap-1 overflow-x-auto scrollbar-none aria-busy:overflow-hidden" aria-busy={loading}
                 onScrollEnd={() => (wheelTarget.current = null)} onKeyDown={rovingKeyDown}>
                {loading
                    ? Array.from({length: 12}, (_, index) => <span key={index} className="size-12 flex-none animate-pulse rounded-md bg-muted"/>)
                    : packages.map((pack) => (
                        // 하나만 고르는 묶음(라디오처럼)이라 Tab 정지점은 하나이고 패키지 사이는 화살표로 옮긴다.
                        <button
                            type="button"
                            key={pack.package_idx}
                            title={pack.title}
                            aria-pressed={active?.package_idx === pack.package_idx}
                            tabIndex={active?.package_idx === pack.package_idx ? 0 : -1}
                            className="size-12 flex-none cursor-pointer rounded-lg border-2 border-transparent p-0.5 aria-pressed:border-primary aria-pressed:bg-transparent [&>img]:size-full [&>img]:rounded-md [&>img]:object-contain"
                            onClick={(ev) => {
                                setActiveIdx(pack.package_idx);
                                ev.currentTarget.scrollIntoView({behavior: smoothScroll(), block: "nearest", inline: "center"});
                            }}
                        >
                            <img src={pack.main_img_url} alt={pack.title} loading="lazy" decoding="async"/>
                        </button>
                    ))}
            </div>

            <div className="grid h-80 grid-cols-[repeat(auto-fill,minmax(72px,1fr))] content-start gap-1 overflow-y-auto scrollbar-none aria-busy:overflow-hidden" aria-busy={loading}>
                {loading
                    ? Array.from({length: 36}, (_, index) => <span key={index} className="aspect-square w-full animate-pulse rounded-md bg-muted"/>)
                    : (active?.detail ?? []).map((dccon) => (
                        <button type="button" key={dccon.detail_idx} title={dccon.title} className={cn(FOCUS_RING, "aspect-square rounded-lg p-0.5 hover:bg-muted [&>img]:size-full [&>img]:rounded-md [&>img]:object-contain")} onClick={() => clickDccon(dccon)}>
                            <img src={dccon.list_img} alt={dccon.title} loading="lazy" decoding="async"/>
                        </button>
                    ))}
            </div>
        </ModalDialog>
    );
};
