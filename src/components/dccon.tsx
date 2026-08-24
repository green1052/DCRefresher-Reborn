import {RefreshCw} from "lucide-react";
import {useEffect, useState} from "react";

import {client as ky, createAuthParams} from "@/http/http";

import Loader from "./loader";

import "./dccon.scss";

interface Props {
    onClickDccon: (dccons: DcinsideDccon[], bigDccon: boolean) => void;
    onCloseDccon: () => void;
}

export default function DcconPopup({onClickDccon, onCloseDccon}: Props) {
    const [firstLoad, setFirstLoad] = useState(true);
    const [currentPage, setCurrentPage] = useState(0);
    const [maxPage, setMaxPage] = useState(1);
    const [dcconList, setDcconList] = useState<Record<number, DcinsideDcconDetailList[]>>({});
    const [currentDccon, setCurrentDccon] = useState<DcinsideDccon[] | null>(null);
    const [doubleDccon, setDoubleDccon] = useState(false);
    const [bigDccon, setBigDccon] = useState(false);
    const [selectedDccon, setSelectedDccon] = useState<DcinsideDccon[]>([]);

    const close = () => {
        onCloseDccon();
    };

    const getDcconList = async (refresh = false, page = currentPage) => {
        if (!refresh && dcconList[page]) {
            setCurrentDccon(dcconList[page][0].detail);
            return;
        }

        try {
            const params = createAuthParams();
            params.set("target", "icon");
            params.set("page", String(page));

            const response = await ky
                .post("https://gall.dcinside.com/dccon/lists", {
                    body: params
                })
                .json<DcinsideDcconDetail>();

            if (response.target === "shop") {
                alert("사용 가능한 디시콘이 없습니다.");
                close();
                return;
            }

            setDcconList((prev) => ({
                ...prev,
                [page]: response.list
            }));

            setMaxPage(response.max_page);
            setCurrentDccon(response.list[0].detail);
        } catch {
            alert("디시콘을 불러오는데 실패했습니다.");
            close();
        }
    };

    const pageUp = () => {
        const next = currentPage === maxPage ? 0 : currentPage < maxPage ? currentPage + 1 : currentPage;
        setCurrentPage(next);
        void getDcconList(false, next);
    };

    const pageDown = () => {
        const next = currentPage === 0 ? maxPage : currentPage > 0 ? currentPage - 1 : currentPage;
        setCurrentPage(next);
        void getDcconList(false, next);
    };

    const dcconListClick = (dccons: DcinsideDccon[]) => {
        setFirstLoad(false);
        setCurrentDccon(dccons);
    };

    const dcconClick = (dccon: DcinsideDccon) => {
        if (doubleDccon) {
            const next = [...selectedDccon, dccon];
            setSelectedDccon(next);

            if (next.length === 2) {
                onClickDccon(next, bigDccon);
                close();
            }
        } else {
            onClickDccon([dccon], bigDccon);
            close();
        }
    };

    useEffect(() => {
        void getDcconList();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="refresher-dccon-popup">
            <div className="dccon-header">
                <h3>디시콘</h3>

                <div className="dccon-options">
                    <input
                        checked={doubleDccon}
                        onChange={(ev) => setDoubleDccon(ev.target.checked)}
                        type="checkbox"
                    />
                    <label>더블콘</label>

                    <input
                        checked={bigDccon}
                        onChange={(ev) => setBigDccon(ev.target.checked)}
                        type="checkbox"
                    />
                    <label>대왕콘</label>
                </div>

                <div
                    className="refresh"
                    onClick={() => void getDcconList(true)}
                >
                    <RefreshCw className="refresh-icon"/>
                </div>

                <div
                    className="close"
                    onClick={close}
                >
                    <div className="cross"/>
                    <div className="cross"/>
                </div>
            </div>

            {!Object.keys(dcconList).length ? (
                <Loader/>
            ) : (
                <>
                    <hr/>

                    <ul className="dccon-pager">
                        <li
                            className="pager-prev"
                            onClick={pageDown}
                        >
                            &lt;
                        </li>
                        {(dcconList[currentPage] ?? []).map((dccon) => (
                            <li
                                className="pager-item"
                                key={dccon.title}
                            >
                                <img
                                    alt={dccon.title}
                                    className="pager-img"
                                    onClick={() => dcconListClick(dccon.detail)}
                                    src={dccon.main_img_url}
                                />
                            </li>
                        ))}
                        <li
                            className="pager-next"
                            onClick={pageUp}
                        >
                            &gt;
                        </li>
                    </ul>

                    <hr/>

                    <div className="dccon-grid-wrap">
                        {firstLoad ? (
                            <h2 className="dccon-placeholder">
                                디시콘을 클릭해주세요.
                            </h2>
                        ) : (
                            <ul className="dccon-grid">
                                {(currentDccon ?? []).map((dccon) => (
                                    <li
                                        className="dccon-grid-item"
                                        key={dccon.detail_idx}
                                        onClick={() => dcconClick(dccon)}
                                    >
                                        <img
                                            alt={dccon.title}
                                            className="dccon-grid-img"
                                            src={dccon.list_img}
                                        />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
