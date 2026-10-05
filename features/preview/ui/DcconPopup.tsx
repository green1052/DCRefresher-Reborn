import {useEffect, useId, useState} from "react";

import {DialogCloseButton, ModalDialog} from "@/components/dialogs";
import {Button} from "@/components/ui/button";
import {DialogTitle} from "@/components/ui/dialog";
import {Field, FieldLabel} from "@/components/ui/field";
import {Skeleton} from "@/components/ui/skeleton";
import {Switch} from "@/components/ui/switch";
import {fetchDcconList} from "@/core/preview/request";
import type {DcinsideDccon, DcinsideDcconDetailList} from "@/core/preview/types";
import {useUiStore} from "@/stores/ui";
import {smoothScroll} from "@/utils/dom";

/** 디시콘 패키지 목록 캐시. 창을 닫았다 열어도 다시 받지 않고, 새로 산 디시콘이 보이도록 10분 뒤 다시 받는다. */
let listCache: { list: DcinsideDcconDetailList[]; at: number } | null = null;
const LIST_TTL = 10 * 60_000;

/** 디시콘 목록 캐시를 비운다. 정보 창(DcconInfoPopup)에서 디시콘을 추가하면 다음에 열 때 새로 받아 보이게 한다. */
export const clearDcconListCache = (): void => {
    listCache = null;
};

interface DcconPopupProps {
    onSelect: (dccons: DcinsideDccon[], bigDccon: boolean) => void;
    onClose: () => void;
}

export const DcconPopup = ({onSelect, onClose}: DcconPopupProps) => {
    const cached = listCache && Date.now() - listCache.at < LIST_TTL ? listCache.list : null;
    const [packages, setPackages] = useState(() => cached ?? []);
    const [activePackage, setActivePackage] = useState<string | null>(() => cached?.[0]?.package_idx ?? null);
    const [current, setCurrent] = useState<DcinsideDccon[]>(() => cached?.[0]?.detail ?? []);
    const [doubleDccon, setDoubleDccon] = useState(false);
    const [bigDccon, setBigDccon] = useState(false);
    const [selected, setSelected] = useState<DcinsideDccon[]>([]);
    const [loading, setLoading] = useState(!cached);

    const openPackage = (pack: DcinsideDcconDetailList): void => {
        setActivePackage(pack.package_idx);
        setCurrent(pack.detail);
    };

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

            listCache = {list: result, at: Date.now()};
            setPackages(result);
            if (result[0]) openPackage(result[0]);
            setLoading(false);
        }, () => {
            if (signal.aborted) return;
            useUiStore.getState().showToast("디시콘을 불러오지 못했습니다.", "error");
            onClose();
        });

        return () => controller.abort();
    }, []);

    const id = useId();

    const clickDccon = (dccon: DcinsideDccon): void => {
        const next = doubleDccon ? [...selected, dccon] : [dccon];
        if (!doubleDccon || next.length === 2) onSelect(next, bigDccon);
        else setSelected(next);
    };

    return (
        <ModalDialog onClose={onClose} className="sm:max-w-[560px]" focusOnOpen="keyboard">
            <div className="flex items-center justify-between">
                <DialogTitle>디시콘</DialogTitle>
                <div className="flex items-center gap-4">
                    <Field orientation="horizontal">
                        <FieldLabel htmlFor={`${id}-double`} className="font-normal">더블콘</FieldLabel>
                        <Switch id={`${id}-double`} size="sm" checked={doubleDccon} onCheckedChange={(value) => {
                            setDoubleDccon(value);
                            setSelected([]);
                        }}/>
                    </Field>
                    <Field orientation="horizontal">
                        <FieldLabel htmlFor={`${id}-big`} className="font-normal">대왕콘</FieldLabel>
                        <Switch id={`${id}-big`} size="sm" checked={bigDccon} onCheckedChange={setBigDccon}/>
                    </Field>
                    <DialogCloseButton/>
                </div>
            </div>

            {doubleDccon && selected.length > 0 && (
                <div className="flex items-center gap-2">
                    <img src={selected[0]!.list_img} alt={selected[0]!.title} width={32} height={32}/>
                    <span className="flex-1 text-muted-foreground">더블콘 {selected.length}/2 — 하나만 더 선택</span>
                    <Button size="xs" variant="secondary" onClick={() => setSelected([])}>초기화</Button>
                </div>
            )}

            {/* 불러오는 동안은 스켈레톤을 칸이 넘치도록 깔아 꽉 찬 목록처럼 보인다. 넘친 스켈레톤에 스크롤바가 생기지 않게 자른다. */}
            <div className="flex gap-1 overflow-x-auto pb-2 aria-busy:overflow-hidden" aria-busy={loading}>
                {loading
                    ? Array.from({length: 12}, (_, index) => <Skeleton key={index} className="size-12 flex-none"/>)
                    : packages.map((pack) => (
                        <button
                            type="button"
                            key={pack.package_idx}
                            aria-pressed={activePackage === pack.package_idx}
                            title={pack.title}
                            className="cursor-pointer rounded-lg p-0.5 hover:bg-muted [&>img]:size-full [&>img]:object-contain size-12 flex-none border-2 border-transparent aria-pressed:border-primary"
                            onClick={(ev) => {
                                openPackage(pack);
                                ev.currentTarget.scrollIntoView({behavior: smoothScroll(), block: "nearest", inline: "center"});
                            }}
                        >
                            <img src={pack.main_img_url} alt={pack.title}/>
                        </button>
                    ))}
            </div>

            <div className="grid h-80 grid-cols-[repeat(auto-fill,minmax(72px,1fr))] content-start gap-1 overflow-y-auto aria-busy:overflow-hidden" aria-busy={loading}>
                {loading
                    ? Array.from({length: 36}, (_, index) => <Skeleton key={index} className="aspect-square w-full"/>)
                    : current.map((dccon) => (
                        <button type="button" key={dccon.detail_idx} title={dccon.title} className="cursor-pointer rounded-lg p-0.5 hover:bg-muted [&>img]:size-full [&>img]:object-contain aspect-square" onClick={() => clickDccon(dccon)}>
                            <img src={dccon.list_img} alt={dccon.title}/>
                        </button>
                    ))}
            </div>
        </ModalDialog>
    );
};
