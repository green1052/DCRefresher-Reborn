import {Badge, Button, Dialog, Flex, Link, Skeleton, Text} from "@radix-ui/themes";
import {LRUCache} from "lru-cache";
import {type MouseEvent, useEffect, useState} from "react";

import {overlay} from "@/components/overlay/shadow";
import {useOpenerFocus} from "@/components/useOpenerFocus";
import {dcconCode} from "@/core/block";
import {urls} from "@/core/http/urls";
import {addDcconPackage, fetchDcconPackage} from "@/core/preview/request";
import type {DcinsideDcconPackage} from "@/core/preview/types";
import {useUiStore} from "@/stores/ui";

import {clearDcconListCache} from "./DcconPopup";
import {usePreviewStore} from "./previewStore";

/**
 * 디시콘 코드별 패키지 정보. 같은 디시콘을 다시 눌러도 받지 않는다 (디시콘 목록 캐시처럼 10분).
 * 디시콘을 추가하면 가진 여부(residual)가 바뀌므로 비운다. 같은 패키지의 다른 디시콘도 코드가 달라 따로 담기기 때문이다
 */
const packageCache = new LRUCache<string, DcinsideDcconPackage>({max: 100, ttl: 10 * 60_000});

const close = (): void => usePreviewStore.setState({dcconInfo: null});

/**
 * 본문·댓글에서 누른 디시콘의 정보 창을 연다. 디시콘을 눌렀으면 true.
 * 본문·댓글은 HTML 문자열로 그려 디시콘이 React 요소가 아니라서 감싼 상자의 클릭에서 찾는다. 차단으로 가린 디시콘은 '가린 내용 보기' 동안만 연다
 */
export const openDcconInfo = (ev: MouseEvent<HTMLElement>): boolean => {
    const dccon = ev.target instanceof Element ? ev.target.closest<HTMLElement>(".written_dccon") : null;
    if (!dccon || (dccon.closest("[data-blocked]") && !dccon.closest("[data-block-revealed]"))) return false;

    const code = dcconCode(dccon);
    if (code) usePreviewStore.setState({dcconInfo: code});
    return Boolean(code);
};

/** 제작·태그 줄 앞의 작은 딱지 (디시 정보창의 tbox) */
const Label = ({children}: { children: string }) => (
    <Badge size="1" variant="outline" color="gray" radius="small">{children}</Badge>
);

/** 댓글·본문의 디시콘을 눌렀을 때 그 디시콘이 든 패키지 정보를 보여 준다 (디시 '디시콘 보기' 창) */
export const DcconInfoPopup = ({code}: { code: string }) => {
    const [dccon, setDccon] = useState(() => packageCache.get(code) ?? null);
    const [sending, setSending] = useState(false);
    const [added, setAdded] = useState(false);
    const focus = useOpenerFocus();

    const addDccon = async (packageIdx: string | number): Promise<void> => {
        // 디시도 무료 디시콘은 묻지 않고 바로 추가한다 (dc_common2.js의 btn_buy)
        if (sending) return;
        setSending(true);

        const result = await addDcconPackage(packageIdx).catch(() => "fail" as const);
        const {showToast} = useUiStore.getState();

        if (result === "ok") {
            clearDcconListCache();
            packageCache.clear();
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
        // 닫거나 다른 디시콘을 누르면 요청을 끊고 늦게 온 결과는 버린다
        const controller = new AbortController();
        const {signal} = controller;

        void fetchDcconPackage(code, signal).then((result) => {
            packageCache.set(code, result);
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
        <Dialog.Root open onOpenChange={(open) => !open && close()}>
            <Dialog.Content container={overlay.portal} maxWidth="600px" onOpenAutoFocus={focus.onOpenAutoFocus}
                            onCloseAutoFocus={focus.onCloseAutoFocus}>
                <Dialog.Title>디시콘 정보</Dialog.Title>

                <div className="refresher-dccon-info-head">
                    {info ? <img src={urls.dccon.image + info.main_img_path} alt={info.title}/> : <Skeleton width="120px" height="120px"/>}

                    <Flex direction="column" gap="2" minWidth="0" flexGrow="1">
                        {info ? (
                            <>
                                <Flex justify="between" align="start" gap="3">
                                    <Text size="4" weight="bold">{info.title}</Text>
                                    {!info.register && !info.residual && !added &&<Button loading={sending} size="2" style={{flexShrink: 0}} onClick={() => void addDccon(info.package_idx)}>사용</Button>}
                                </Flex>
                                {info.description && <Text size="2">{info.description}</Text>}
                                <Flex align="center" gap="2" wrap="wrap">
                                    <Label>제작</Label>
                                    <Link size="2" href={`${urls.dccon.shop}/nick_name/${encodeURIComponent(info.seller_name)}`} target="_blank"
                                          rel="noopener noreferrer">{info.seller_name}</Link>
                                    <Text size="2" color="gray">{info.reg_date_short}</Text>
                                </Flex>
                                {dccon.tags.length > 0 && (
                                    <Flex align="center" gap="2" wrap="wrap">
                                        <Label>태그</Label>
                                        {dccon.tags.map(({tag}) => (
                                            <Link key={tag} size="2" href={`${urls.dccon.shop}/tags/${encodeURIComponent(tag)}`} target="_blank"
                                                  rel="noopener noreferrer">{tag}</Link>
                                        ))}
                                    </Flex>
                                )}
                            </>
                        ) : (
                            <>
                                <Skeleton width="160px" height="24px"/>
                                <Skeleton width="280px" height="18px"/>
                                <Skeleton width="200px" height="18px"/>
                            </>
                        )}
                    </Flex>
                </div>

                <div className="refresher-dccon-info-grid">
                    {dccon
                        ? dccon.detail.map((item) => <img key={item.idx} src={urls.dccon.image + item.path} alt={item.title} title={item.title}/>)
                        : Array.from({length: 12}, (_, index) => <Skeleton key={index} style={{aspectRatio: 1}}/>)}
                </div>
            </Dialog.Content>
        </Dialog.Root>
    );
};
