import {useEffect, useId, useState} from "react";

import {DialogCloseButton, ModalDialog} from "@/components/dialogs";
import {Button} from "@/components/ui/button";
import {DialogTitle} from "@/components/ui/dialog";
import {Field, FieldLabel} from "@/components/ui/field";
import {Skeleton} from "@/components/ui/skeleton";
import {Switch} from "@/components/ui/switch";
import {ajax} from "@/core/http/client";
import {urls} from "@/core/http/urls";
import type {DcinsideDccon, DcinsideDcconDetail, DcinsideDcconDetailList} from "@/core/preview/types";
import {useUiStore} from "@/stores/ui";
import {csrfBody} from "@/core/http/cookie";
import {smoothScroll} from "@/utils/dom";

/** 디시콘 패키지 목록 캐시. 창을 닫았다 열어도 다시 받지 않고, 새로 산 디시콘이 보이도록 10분 뒤 다시 받는다. */
let listCache: { list: DcinsideDcconDetailList[]; at: number } | null = null;
const LIST_TTL = 10 * 60_000;
// 쪽이 이보다 많으면 뒤쪽은 받지 않는다. 한 쪽에 패키지 여러 개라 보통 몇 쪽이다.
const MAX_PAGES = 20;

type ListResult = DcinsideDcconDetailList[] | "not_login" | "shop";

/** 디시콘 목록 캐시를 비운다. 정보 창(DcconInfoPopup)에서 디시콘을 추가하면 다음에 열 때 새로 받아 보이게 한다. */
export const clearDcconListCache = (): void => {
    listCache = null;
};

/** 한 쪽. 비로그인이면 JSON 대신 'not_login'이 온다 (디시 dccon.js). */
const fetchPage = async (page: number, signal: AbortSignal): Promise<DcinsideDcconDetail | "not_login"> => {
    const body = await csrfBody({target: "icon", page: String(page)});
    const text = await ajax.post(urls.dccon.lists, {body, signal}).text();
    if (/^"?not_login"?$/.test(text.trim())) return "not_login";

    const response = JSON.parse(text) as DcinsideDcconDetail;
    // 다른 모양(실패 응답 등)이면 목록을 그리다 오버레이 전체가 깨지므로 실패로 넘긴다.
    if (response.target !== "shop" && !Array.isArray(response.list)) throw new Error("디시콘 목록이 아닙니다.");
    return response;
};

/**
 * 모든 쪽의 패키지를 이어 붙인다. 디시는 쪽마다 따로 주고(0부터 max_page까지) 창 안에서 넘기게 하지만,
 * 한 줄로 이어 두면 넘기지 않고 가로로 훑어 고를 수 있다. 첫 쪽 뒤의 쪽은 한꺼번에 받는다 (동시 요청 수는 요청 제한을 따른다).
 */
const fetchAllPackages = async (signal: AbortSignal): Promise<ListResult> => {
    const first = await fetchPage(0, signal);
    if (first === "not_login") return first;
    if (first.target === "shop") return "shop";

    // max_page가 문자열로 오기도 한다 (디시 dccon.js도 ==로 비교한다).
    const last = Math.min(Number(first.max_page) || 0, MAX_PAGES - 1);
    const rest = await Promise.all(Array.from({length: last}, (_, index) => fetchPage(index + 1, signal)));
    return [first, ...rest].flatMap((page) => (page !== "not_login" && Array.isArray(page.list) ? page.list : []));
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

        void fetchAllPackages(signal).then((result) => {
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
