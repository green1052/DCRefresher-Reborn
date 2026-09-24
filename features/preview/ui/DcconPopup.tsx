import {useEffect, useState} from "react";
import {ChevronLeft, ChevronRight, X} from "lucide-react";
import {Dialog, Switch} from "radix-ui";

import {http} from "@/core/http/client";
import {urls} from "@/core/http/urls";
import type {DcinsideDccon, DcinsideDcconDetail, DcinsideDcconDetailList} from "@/features/types";
import {useUiStore} from "@/stores/ui";

interface DcconPopupProps {
    onSelect: (dccons: DcinsideDccon[], bigDccon: boolean) => void;
    onClose: () => void;
}

/** 디시콘 선택 팝업 */
export const DcconPopup = ({onSelect, onClose}: DcconPopupProps) => {
    const [page, setPage] = useState(0);
    const [maxPage, setMaxPage] = useState(1);
    const [packages, setPackages] = useState<Record<number, DcinsideDcconDetailList[]>>({});
    const [activePackage, setActivePackage] = useState<string | null>(null);
    const [current, setCurrent] = useState<DcinsideDccon[]>([]);
    const [doubleDccon, setDoubleDccon] = useState(false);
    const [bigDccon, setBigDccon] = useState(false);
    const [selected, setSelected] = useState<DcinsideDccon[]>([]);
    const [loading, setLoading] = useState(true);

    const openPackage = (pack: DcinsideDcconDetailList): void => {
        setActivePackage(pack.package_idx);
        setCurrent(pack.detail);
    };

    const getList = async (targetPage: number): Promise<void> => {
        const cached = packages[targetPage];
        if (cached) {
            if (cached[0]) openPackage(cached[0]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const body = new URLSearchParams({
                ci_t: (await cookieStore.get("ci_c"))?.value ?? "",
                target: "icon",
                page: String(targetPage)
            });

            const response = await http.post(urls.dccon.lists, {body}).json<DcinsideDcconDetail>();

            if (response.target === "shop") {
                useUiStore.getState().showToast("사용 가능한 디시콘이 없습니다.", "error");
                onClose();
                return;
            }

            setPackages((prev) => ({...prev, [targetPage]: response.list}));
            setMaxPage(response.max_page);
            if (response.list[0]) openPackage(response.list[0]);
        } catch {
            useUiStore.getState().showToast("디시콘을 불러오는데 실패했습니다.", "error");
            onClose();
            return;
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void getList(0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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

    const visible = packages[page] ?? [];

    return (
        <Dialog.Root
            open
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <Dialog.Portal>
                <Dialog.Overlay className="refresher-overlay" />
                <Dialog.Content className="refresher-dccon-popup" onOpenAutoFocus={(event) => event.preventDefault()}>
                    <Dialog.Close asChild>
                        <button type="button" className="refresher-popup-close">
                            <X size={14} />
                        </button>
                    </Dialog.Close>

                    <div className="dccon-toolbar">
                        <Dialog.Title>디시콘</Dialog.Title>
                        <div className="dccon-toolbar-toggles">
                            <label className="dccon-toggle">
                                더블콘
                                <Switch.Root className="refresher-switch-root" checked={doubleDccon} onCheckedChange={setDoubleDccon}>
                                    <Switch.Thumb className="refresher-switch-thumb" />
                                </Switch.Root>
                            </label>
                            <label className="dccon-toggle">
                                대왕콘
                                <Switch.Root className="refresher-switch-root" checked={bigDccon} onCheckedChange={setBigDccon}>
                                    <Switch.Thumb className="refresher-switch-thumb" />
                                </Switch.Root>
                            </label>
                        </div>
                    </div>

                    {doubleDccon && selected.length > 0 && (
                        <div className="dccon-selected">
                            <img src={selected[0]!.list_img} alt={selected[0]!.title} />
                            <span>더블콘 {selected.length}/2 — 하나만 더 선택</span>
                            <button type="button" onClick={() => setSelected([])}>
                                초기화
                            </button>
                        </div>
                    )}

                    <div className="dccon-packages">
                        {loading && visible.length === 0
                            ? Array.from({length: 8}, (_, index) => <span key={index} className="dccon-skeleton" />)
                            : visible.map((pack) => (
                                  <button
                                      type="button"
                                      key={pack.package_idx}
                                      className={activePackage === pack.package_idx ? "active" : undefined}
                                      title={pack.title}
                                      onClick={() => openPackage(pack)}
                                  >
                                      <img src={pack.main_img_url} alt={pack.title} />
                                  </button>
                              ))}
                    </div>

                    <div className="dccon-grid-wrap">
                        <div className="dccon-grid">
                            {loading && current.length === 0
                                ? Array.from({length: 18}, (_, index) => <span key={index} className="dccon-skeleton" />)
                                : current.map((dccon) => (
                                      <button type="button" key={dccon.detail_idx} title={dccon.title} onClick={() => clickDccon(dccon)}>
                                          <img src={dccon.list_img} alt={dccon.title} />
                                      </button>
                                  ))}
                        </div>
                    </div>

                    <div className="dccon-footer">
                        <button type="button" onClick={() => movePage(-1)} title="이전 패키지 목록">
                            <ChevronLeft size={16} />
                        </button>
                        <span>
                            {page + 1} / {maxPage + 1}
                        </span>
                        <button type="button" onClick={() => movePage(1)} title="다음 패키지 목록">
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};
