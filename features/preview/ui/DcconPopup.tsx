import {Button, Dialog, Flex, IconButton, Skeleton, Switch, Text} from "@radix-ui/themes";
import {ChevronLeft, ChevronRight} from "lucide-react";
import {useEffect, useRef, useState} from "react";

import {overlay} from "@/components/overlay/shadow";
import {ajax} from "@/core/http/client";
import {urls} from "@/core/http/urls";
import type {DcinsideDccon, DcinsideDcconDetail, DcinsideDcconDetailList} from "@/core/preview/types";
import {useUiStore} from "@/stores/ui";
import {csrfToken} from "@/utils/cookie";

/** 디시콘 목록 캐시 — 창을 닫았다 열어도 다시 받지 않는다. 페이지를 새로 열면 비고, 새로 산 디시콘이 보이도록 10분 뒤 만료 */
const LIST_TTL = 10 * 60_000;
const listCache = new Map<number, { list: DcinsideDcconDetailList[]; maxPage: number; at: number }>();

const cachedList = (page: number) => {
    const entry = listCache.get(page);
    return entry && Date.now() - entry.at < LIST_TTL ? entry : undefined;
};

interface DcconPopupProps {
    onSelect: (dccons: DcinsideDccon[], bigDccon: boolean) => void;
    onClose: () => void;
}

/** 디시콘 선택 팝업 */
export const DcconPopup = ({onSelect, onClose}: DcconPopupProps) => {
    const [page, setPage] = useState(0);
    const [maxPage, setMaxPage] = useState(() => cachedList(0)?.maxPage ?? 1);
    const [activePackage, setActivePackage] = useState<string | null>(null);
    const [current, setCurrent] = useState<DcinsideDccon[]>([]);
    const [doubleDccon, setDoubleDccon] = useState(false);
    const [bigDccon, setBigDccon] = useState(false);
    const [selected, setSelected] = useState<DcinsideDccon[]>([]);
    const [loading, setLoading] = useState(true);

    const packagesRef = useRef<HTMLDivElement>(null);
    /** 마지막으로 요청한 페이지 — 빠르게 넘기면 늦게 온 이전 페이지 응답이 그리드를 덮고 로딩을 끈다 */
    const latest = useRef(0);

    const openPackage = (pack: DcinsideDcconDetailList): void => {
        setActivePackage(pack.package_idx);
        setCurrent(pack.detail);
    };

    const getList = async (targetPage: number): Promise<void> => {
        latest.current = targetPage;
        const cached = cachedList(targetPage);
        if (cached) {
            setMaxPage(cached.maxPage);
            if (cached.list[0]) openPackage(cached.list[0]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const body = new URLSearchParams({
                ci_t: await csrfToken(),
                target: "icon",
                page: String(targetPage)
            });

            const text = await ajax.post(urls.dccon.lists, {body}).text();
            if (latest.current !== targetPage) return;

            // 비로그인이면 JSON 대신 'not_login'이 온다 (dccon.js) — 받기 실패가 아니다
            if (/^"?not_login"?$/.test(text.trim())) {
                useUiStore.getState().showToast("디시콘은 로그인한 뒤에 쓸 수 있습니다.", "warning");
                onClose();
                return;
            }

            const response = JSON.parse(text) as DcinsideDcconDetail;
            if (response.target === "shop") {
                useUiStore.getState().showToast("사용 가능한 디시콘이 없습니다.", "error");
                onClose();
                return;
            }

            listCache.set(targetPage, {list: response.list, maxPage: response.max_page, at: Date.now()});
            setMaxPage(response.max_page);
            if (response.list[0]) openPackage(response.list[0]);
        } catch {
            if (latest.current !== targetPage) return;
            useUiStore.getState().showToast("디시콘을 불러오는 데 실패했습니다.", "error");
            onClose();
            return;
        } finally {
            if (latest.current === targetPage) setLoading(false);
        }
    };

    useEffect(() => {
        void getList(0);
        // 닫으면 받는 중인 요청을 무효로 — 늦게 온 실패가 다시 연 창을 닫지 않게 (onClose는 새 창도 닫는다)
        return () => {
            latest.current = -1;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (packagesRef.current) packagesRef.current.scrollLeft = 0;
    }, [page]);

    const movePage = (delta: number): void => {
        const next = page === 0 && delta < 0 ? maxPage : page === maxPage && delta > 0 ? 0 : page + delta;
        setPage(next);
        void getList(next);
    };

    const clickDccon = (dccon: DcinsideDccon): void => {
        if (!doubleDccon) {
            onSelect([dccon], bigDccon);
            return;
        }

        const next = [...selected, dccon];
        if (next.length === 2) {
            onSelect(next, bigDccon);
            return;
        }

        setSelected(next);
    };

    // TTL은 다시 받을지 정할 때만 — 창을 연 채 10분이 지나도 목록이 비지 않게 (만료된 항목도 지우지 않고 남아 있다)
    const visible = listCache.get(page)?.list ?? [];

    return (
        <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
            <Dialog.Content container={overlay.portal} maxWidth="560px" onOpenAutoFocus={(ev) => ev.preventDefault()}>
                <Flex justify="between" align="center" mb="3">
                    <Dialog.Title mb="0">디시콘</Dialog.Title>
                    <Flex gap="4">
                        <Text as="label" size="2">
                            <Flex gap="2" align="center">
                                더블콘 <Switch size="1" checked={doubleDccon} onCheckedChange={(value) => {
                                setDoubleDccon(value);
                                setSelected([]);
                            }}/>
                            </Flex>
                        </Text>
                        <Text as="label" size="2">
                            <Flex gap="2" align="center">
                                대왕콘 <Switch size="1" checked={bigDccon} onCheckedChange={setBigDccon}/>
                            </Flex>
                        </Text>
                    </Flex>
                </Flex>

                {doubleDccon && selected.length > 0 && (
                    <Flex align="center" gap="2" mb="2">
                        <img src={selected[0]!.list_img} alt={selected[0]!.title} width={32} height={32}/>
                        <Text size="2" color="gray" style={{flex: 1}}>더블콘 {selected.length}/2 — 하나만 더 선택</Text>
                        <Button size="1" variant="soft" color="gray" onClick={() => setSelected([])}>초기화</Button>
                    </Flex>
                )}

                <div className="refresher-dccon-packages" ref={packagesRef}>
                    {loading && visible.length === 0
                        ? Array.from({length: 8}, (_, index) => <Skeleton key={index} width="48px" height="48px"/>)
                        : visible.map((pack) => (
                            <button
                                type="button"
                                key={pack.package_idx}
                                data-active={activePackage === pack.package_idx || undefined}
                                title={pack.title}
                                onClick={(ev) => {
                                    openPackage(pack);
                                    ev.currentTarget.scrollIntoView({behavior: "smooth", block: "nearest", inline: "center"});
                                }}
                            >
                                <img src={pack.main_img_url} alt={pack.title}/>
                            </button>
                        ))}
                </div>

                <div className="refresher-dccon-grid">
                    {loading && current.length === 0
                        ? Array.from({length: 18}, (_, index) => <Skeleton key={index} style={{aspectRatio: 1}}/>)
                        : current.map((dccon) => (
                            <button type="button" key={dccon.detail_idx} title={dccon.title} onClick={() => clickDccon(dccon)}>
                                <img src={dccon.list_img} alt={dccon.title}/>
                            </button>
                        ))}
                </div>

                <Flex justify="center" align="center" gap="3" mt="3">
                    <IconButton variant="ghost" color="gray" aria-label="이전 패키지 목록" onClick={() => movePage(-1)}>
                        <ChevronLeft size={16}/>
                    </IconButton>
                    <Text size="2" color="gray">{page + 1} / {maxPage + 1}</Text>
                    <IconButton variant="ghost" color="gray" aria-label="다음 패키지 목록" onClick={() => movePage(1)}>
                        <ChevronRight size={16}/>
                    </IconButton>
                </Flex>
            </Dialog.Content>
        </Dialog.Root>
    );
};
