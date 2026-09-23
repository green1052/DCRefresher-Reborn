import {Box, Checkbox, Flex, Heading, IconButton, ScrollArea, Separator, Spinner, Text} from "@radix-ui/themes";
import {ChevronLeft, ChevronRight, RefreshCw, X} from "lucide-react";
import {useEffect, useRef, useState} from "react";

import * as http from "@/http/http";
import toast from "@/utils/toast";

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

    // 페이저 연타 시 응답 역전을 가리기 위한 요청 일련번호. 응답이 역전되면 최신 요청만 화면에 반영.
    const requestId = useRef(0);

    const close = () => {
        onCloseDccon();
    };

    const getDcconList = async (refresh = false, page = currentPage) => {
        if (!refresh && dcconList[page]) {
            setCurrentDccon(dcconList[page][0].detail);
            return;
        }

        const id = ++requestId.current;

        try {
            const params = http.createAuthParams();
            params.set("target", "icon");
            params.set("page", String(page));

            const response = await http.client
                .post("https://gall.dcinside.com/dccon/lists", {
                    body: params
                })
                .json<DcinsideDcconDetail>();

            if (response.target === "shop") {
                if (id === requestId.current) {
                    toast.show("사용 가능한 디시콘이 없습니다.");
                    close();
                }
                return;
            }

            // 어느 페이지의 응답이든 캐시에는 누적한다.
            setDcconList((prev) => ({
                ...prev,
                [page]: response.list
            }));

            // 응답 역전: 더 최신 요청이 기다리고 있다면 화면 갱신은 그쪽에 맡긴다.
            if (id !== requestId.current) return;

            setMaxPage(response.max_page);
            setCurrentDccon(response.list[0].detail);
        } catch {
            if (id !== requestId.current) return;

            toast.show("디시콘을 불러오는데 실패했습니다.");
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
        <Box
            className="refresher-dccon-popup"
            style={{
                backdropFilter: "blur(5px) saturate(150%)",
                background: "var(--color-panel-solid)",
                border: "1px solid var(--gray-a5)",
                borderRadius: "var(--radius-4)",
                boxShadow: "var(--shadow-5)",
                height: 500,
                left: "calc(50% - 350px)",
                padding: "20px 30px",
                position: "fixed",
                top: "calc(50% - 300px)",
                width: 620,
                zIndex: 5002
            }}
        >
            <Flex align="center" gap="3">
                <Heading size="4">디시콘</Heading>

                <Flex align="center" gap="3" ml="auto">
                    <Flex align="center" gap="1">
                        <Checkbox
                            checked={doubleDccon}
                            onCheckedChange={(value) => setDoubleDccon(value === true)}
                            size="1"
                        />
                        <Text size="1">더블콘</Text>
                    </Flex>

                    <Flex align="center" gap="1">
                        <Checkbox
                            checked={bigDccon}
                            onCheckedChange={(value) => setBigDccon(value === true)}
                            size="1"
                        />
                        <Text size="1">대왕콘</Text>
                    </Flex>
                </Flex>

                <IconButton
                    color="gray"
                    onClick={() => void getDcconList(true)}
                    title="새로고침"
                    variant="ghost"
                >
                    <RefreshCw height={16} width={16}/>
                </IconButton>

                <IconButton color="gray" onClick={close} title="닫기" variant="ghost">
                    <X height={16} width={16}/>
                </IconButton>
            </Flex>

            {!Object.keys(dcconList).length ? (
                <Flex align="center" justify="center" style={{height: "calc(100% - 40px)"}}>
                    <Spinner size="3"/>
                </Flex>
            ) : (
                <Flex direction="column" gap="3" mt="3" style={{height: "calc(100% - 40px)"}}>
                    <ScrollArea scrollbars="horizontal" type="hover">
                        <Flex align="center" gap="2" style={{paddingRight: 8}}>
                            <IconButton
                                color="gray"
                                onClick={pageDown}
                                title="이전"
                                variant="ghost"
                            >
                                <ChevronLeft height={18} width={18}/>
                            </IconButton>

                            {(dcconList[currentPage] ?? []).map((dccon) => (
                                <img
                                    alt={dccon.title}
                                    key={dccon.title}
                                    onClick={() => dcconListClick(dccon.detail)}
                                    src={dccon.main_img_url}
                                    style={{
                                        cursor: "pointer",
                                        flexShrink: 0,
                                        height: 53,
                                        objectFit: "cover"
                                    }}
                                />
                            ))}

                            <IconButton
                                color="gray"
                                onClick={pageUp}
                                title="다음"
                                variant="ghost"
                            >
                                <ChevronRight height={18} width={18}/>
                            </IconButton>
                        </Flex>
                    </ScrollArea>

                    <Separator size="4"/>

                    <ScrollArea style={{flexGrow: 1}} type="hover">
                        {firstLoad ? (
                            <Flex align="center" justify="center" style={{height: "100%"}}>
                                <Text size="4" weight="bold">디시콘을 클릭해주세요.</Text>
                            </Flex>
                        ) : (
                            <Box
                                style={{
                                    display: "grid",
                                    gap: 4,
                                    gridTemplateColumns: "repeat(6, 1fr)"
                                }}
                            >
                                {(currentDccon ?? []).map((dccon) => (
                                    <img
                                        alt={dccon.title}
                                        key={dccon.detail_idx}
                                        onClick={() => dcconClick(dccon)}
                                        src={dccon.list_img}
                                        style={{
                                            cursor: "pointer",
                                            height: 100,
                                            objectFit: "contain",
                                            width: "100%"
                                        }}
                                    />
                                ))}
                            </Box>
                        )}
                    </ScrollArea>
                </Flex>
            )}
        </Box>
    );
}
