import {Ban, ChevronDown, ChevronUp, Pin, Trash2} from "lucide-react";
import {useEffect, useRef, useState} from "react";

import toast from "@/utils/toast";
import {handleManageResponse, type PreviewRequest} from "../../request";
import type {BlockPreset} from "../../panel";

import "./adminPanel.scss";

interface Props {
    preData: GalleryPreData;
    toggleBlur: boolean;
    useKeyPress: boolean;
    request: PreviewRequest;
    blockPreset: BlockPreset;
    closeFrame: () => void;
    emitRefreshRequest: () => void;
    onOpenBlock: () => void;
}

export default function AdminPanel({
    preData,
    toggleBlur,
    useKeyPress,
    request,
    blockPreset,
    closeFrame,
    emitRefreshRequest,
    onOpenBlock
}: Props) {
    const [setAsNotice, setSetAsNotice] = useState(!preData.notice);
    const [setAsRecommend, setSetAsRecommend] = useState(!preData.recommend);

    const pinLabel = setAsNotice ? "공지로 등록" : "공지 등록 해제";
    const recommendLabel = setAsRecommend ? "개념글 등록" : "개념글 해제";

    // 성공 시 onSuccess 실행. pin/recommend는 토글 반전에 사용한다.
    const handleResponse = (response: unknown, onSuccess?: () => void): void => {
        emitRefreshRequest();
        handleManageResponse(response, onSuccess);
    };

    const pin = (): void => {
        void request.setNotice(preData, setAsNotice).then((response) => {
            handleResponse(response, () => {
                setSetAsNotice((v) => !v);
            });
        });
    };

    const recommend = (): void => {
        void request.setRecommend(preData, setAsRecommend).then((response) => {
            handleResponse(response, () => {
                setSetAsRecommend((v) => !v);
            });
        });
    };

    const doDelete = (): void => {
        closeFrame();
        void request.delete(preData).then(handleResponse);
    };

    const doBlockWithPreset = (): void => {
        closeFrame();
        void request
            .block(
                preData,
                Number(blockPreset.day),
                0,
                blockPreset.reason,
                blockPreset.delete ? 1 : 0,
                blockPreset.user_type ? 1 : 0
            )
            .then(handleResponse);
    };

    const bump = (): void => {
        void request.bump(preData).then(handleResponse);
    };

    // 키 입력 카운트 (D=삭제, B=차단, 2회 연속)
    const keyCounts = useRef<Record<string, [number, number]>>({});
    const actions = useRef({doDelete, doBlockWithPreset});
    actions.current = {doDelete, doBlockWithPreset};

    useEffect(() => {
        if (!useKeyPress) return;

        const onKeyPress = (ev: KeyboardEvent): void => {
            if (ev.code !== "KeyB" && ev.code !== "KeyD") return;

            // 댓글 입력 등 타이핑 중 D/B 연타로 삭제/차단이 나가면 안 된다
            if ((ev.target as HTMLElement).closest("input, textarea, [contenteditable=true]")) return;

            const counts = keyCounts.current;
            if (!counts[ev.code] || Date.now() - counts[ev.code][0] > 1000) {
                counts[ev.code] = [Date.now(), 0];
            }

            counts[ev.code][0] = Date.now();
            counts[ev.code][1]++;

            const count = counts[ev.code][1];

            if (ev.code === "KeyD") {
                if (count >= 2) {
                    actions.current.doDelete();
                    counts[ev.code][1] = 0;
                } else {
                    toast.show("한번 더 D키를 누르면 게시글을 삭제합니다.", "warning", 1000);
                }
            } else {
                if (count >= 2) {
                    actions.current.doBlockWithPreset();
                    counts[ev.code][1] = 0;
                } else {
                    toast.show("한번 더 B키를 누르면 차단합니다.", "warning", 1000);
                }
            }
        };

        document.addEventListener("keypress", onKeyPress);
        return () => {
            document.removeEventListener("keypress", onKeyPress);
        };
    }, [useKeyPress]);

    return (
        <div
            className={toggleBlur ? "refresher-management-panel blur" : "refresher-management-panel"}
            id="refresher-management-panel"
        >
            <div
                className="button pin"
                onClick={pin}
            >
                <Pin className="refresher-mgmt-icon"/>
                <p>{pinLabel}</p>
            </div>
            <div
                className="button recommend"
                onClick={recommend}
            >
                {setAsRecommend ? <ChevronUp className="refresher-mgmt-icon"/> : <ChevronDown className="refresher-mgmt-icon"/>}
                <p>{recommendLabel}</p>
            </div>
            <div
                className="button block"
                onClick={onOpenBlock}
            >
                <Ban className="refresher-mgmt-icon"/>
                <p>차단 (B)</p>
            </div>
            <div
                className="button delete"
                onClick={doDelete}
            >
                <Trash2 className="refresher-mgmt-icon"/>
                <p>삭제 (D)</p>
            </div>
            <div
                className="button bump"
                onClick={bump}
            >
                <ChevronUp className="refresher-mgmt-icon"/>
                <p>끌올</p>
            </div>
        </div>
    );
}
