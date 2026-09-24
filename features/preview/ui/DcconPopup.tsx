import {useEffect, useState} from "react";
import {RefreshCw, X} from "lucide-react";

import {http} from "@/core/http/client";
import {urls} from "@/core/http/urls";
import type {DcinsideDccon, DcinsideDcconDetail, DcinsideDcconDetailList} from "@/features/types";
import {useUiStore} from "@/stores/ui";

interface DcconPopupProps {
    onSelect: (dccons: DcinsideDccon[], bigDccon: boolean) => void;
    onClose: () => void;
}

/** 디시콘 선택 팝업 (v5 components/dccon.vue 이식) */
export const DcconPopup = ({onSelect, onClose}: DcconPopupProps) => {
    const [firstLoad, setFirstLoad] = useState(true);
    const [page, setPage] = useState(0);
    const [maxPage, setMaxPage] = useState(1);
    const [packages, setPackages] = useState<Record<number, DcinsideDcconDetailList[]>>({});
    const [current, setCurrent] = useState<DcinsideDccon[] | null>(null);
    const [doubleDccon, setDoubleDccon] = useState(false);
    const [bigDccon, setBigDccon] = useState(false);
    const [selected, setSelected] = useState<DcinsideDccon[]>([]);
    const [loading, setLoading] = useState(true);

    const getList = async (targetPage: number, refresh = false): Promise<void> => {
        if (!refresh && packages[targetPage]) {
            setCurrent(packages[targetPage][0]?.detail ?? null);
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
            setCurrent(response.list[0]?.detail ?? null);
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

    return (
        <div className="refresher-dccon-popup">
            <button type="button" className="refresher-popup-close" onClick={onClose}>
                <X size={14} />
            </button>

            <div className="dccon-header">
                <h3>디시콘</h3>
                <label>
                    <input type="checkbox" checked={doubleDccon} onChange={(event) => setDoubleDccon(event.target.checked)} />
                    더블콘
                </label>
                <label>
                    <input type="checkbox" checked={bigDccon} onChange={(event) => setBigDccon(event.target.checked)} />
                    대왕콘
                </label>
                <button type="button" className="dccon-refresh" onClick={() => void getList(page, true)} title="새로고침">
                    <RefreshCw size={16} />
                </button>
            </div>

            {loading && !current ? (
                <div className="dccon-loading">불러오는 중...</div>
            ) : (
                <>
                    <ul className="dccon-pager">
                        <li className="pager-btn" onClick={() => movePage(-1)}>
                            {"<"}
                        </li>
                        {(packages[page] ?? []).map((pack) => (
                            <li
                                key={pack.package_idx}
                                className="pager-item"
                                onClick={() => {
                                    setFirstLoad(false);
                                    setCurrent(pack.detail);
                                }}
                            >
                                <img src={pack.main_img_url} alt={pack.title} />
                            </li>
                        ))}
                        <li className="pager-btn" onClick={() => movePage(1)}>
                            {">"}
                        </li>
                    </ul>

                    <div className="dccon-grid-wrap">
                        {firstLoad ? (
                            <div className="dccon-placeholder">디시콘을 클릭해주세요.</div>
                        ) : (
                            <ul className="dccon-grid">
                                {(current ?? []).map((dccon) => (
                                    <li key={dccon.detail_idx} onClick={() => clickDccon(dccon)}>
                                        <img src={dccon.list_img} alt={dccon.title} />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};
