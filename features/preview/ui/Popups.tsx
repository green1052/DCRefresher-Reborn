import {useState} from "react";
import {X} from "lucide-react";
import {Dialog} from "radix-ui";

import {eventBus} from "@/core/eventbus/bus";
import {blockUser} from "@/core/preview/request";
import {useUiStore} from "@/stores/ui";

import {usePreviewStore} from "./previewStore";

const BLOCK_DAYS: [string, string][] = [
    ["1", "1시간"],
    ["6", "6시간"],
    ["24", "1일"],
    ["168", "7일"],
    ["336", "14일"],
    ["744", "31일"]
];

const BLOCK_REASONS: [string, string][] = [
    ["1", "음란성"],
    ["2", "광고"],
    ["3", "욕설"],
    ["4", "도배"],
    ["5", "저작권 침해"],
    ["6", "명예훼손"],
    ["0", "직접 입력"]
];

const AdminPanel = () => {
    const notice = usePreviewStore((s) => s.notice);
    const recommend = usePreviewStore((s) => s.recommend);
    const requestManage = usePreviewStore((s) => s.requestManage);

    return (
        <div id="refresher-management-panel">
            <div className="refresher-management-panel">
                <button type="button" onClick={() => requestManage("notice")}>
                    {notice ? "공지 등록 해제" : "공지로 등록"}
                </button>
                <button type="button" onClick={() => requestManage("recommend")}>
                    {recommend ? "개념글 해제" : "개념글 등록"}
                </button>
                <button type="button" onClick={() => usePreviewStore.getState().openBlockPopup()}>
                    차단 (B)
                </button>
                <button type="button" onClick={() => requestManage("delete")}>
                    삭제 (D)
                </button>
                <button type="button" onClick={() => requestManage("bump")}>
                    끌올
                </button>
            </div>
        </div>
    );
};

const BlockPopup = () => {
    const preData = usePreviewStore((s) => s.preData);
    const [day, setDay] = useState("1");
    const [reason, setReason] = useState("1");
    const [custom, setCustom] = useState("");
    const [delChk, setDelChk] = useState(false);
    const [userTypeChk, setUserTypeChk] = useState(false);

    const submit = async (): Promise<void> => {
        if (!preData) return;

        try {
            await blockUser(preData, {
                avoidHour: day,
                avoidReason: reason,
                avoidReasonTxt: reason === "0" ? custom : "",
                delChk: delChk ? "1" : "0",
                userTypeChk: userTypeChk ? "1" : "0"
            });
            useUiStore.getState().showToast("차단이 처리되었습니다.");
            if (delChk) usePreviewStore.getState().requestClose();
            eventBus.emit("refreshRequest");
        } catch {
            useUiStore.getState().showToast("차단 처리 중 오류가 발생했습니다.", "error");
        }
        usePreviewStore.getState().closeBlockPopup();
    };

    return (
        <Dialog.Root
            open
            onOpenChange={(open) => {
                if (!open) usePreviewStore.getState().closeBlockPopup();
            }}
        >
            <Dialog.Portal>
                <Dialog.Overlay className="refresher-overlay" style={{background: "transparent"}} />
                <Dialog.Content className="refresher-block-popup" onOpenAutoFocus={(event) => event.preventDefault()}>
                    <Dialog.Close asChild>
                        <button type="button" className="refresher-popup-close">
                            <X size={14} />
                        </button>
                    </Dialog.Close>

                    <Dialog.Title asChild>
                        <h3>유저 차단</h3>
                    </Dialog.Title>

            <div className="refresher-block-popup-section">
                <h4>기간</h4>
                {BLOCK_DAYS.map(([value, label]) => (
                    <label key={value}>
                        <input type="radio" name="block-day" value={value} checked={day === value} onChange={() => setDay(value)} />
                        {label}
                    </label>
                ))}
            </div>

            <div className="refresher-block-popup-section">
                <h4>사유</h4>
                {BLOCK_REASONS.map(([value, label]) => (
                    <label key={value}>
                        <input type="radio" name="block-reason" value={value} checked={reason === value} onChange={() => setReason(value)} />
                        {label}
                    </label>
                ))}
                {reason === "0" && (
                    <input
                        value={custom}
                        placeholder="차단 사유 직접 입력 (한글 20자 이내)"
                        maxLength={20}
                        onChange={(event) => setCustom(event.target.value)}
                    />
                )}
            </div>

            <div className="refresher-block-popup-section">
                <label>
                    <input type="checkbox" checked={delChk} onChange={(event) => setDelChk(event.target.checked)} />
                    선택한 글 삭제
                </label>
                <label>
                    <input type="checkbox" checked={userTypeChk} onChange={(event) => setUserTypeChk(event.target.checked)} />
                    식별 코드 차단 시 IP 동시 차단
                </label>
            </div>

            <button type="button" className="go-block" onClick={() => void submit()}>
                차단
            </button>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};

const CaptchaPopup = () => {
    const captcha = usePreviewStore((s) => s.captcha);
    const [code, setCode] = useState("");

    if (!captcha) return null;

    const send = (): void => {
        if (!code.trim()) return;
        captcha.resolve(code.trim());
        usePreviewStore.getState().closeCaptcha();
    };

    return (
        <Dialog.Root
            open
            onOpenChange={(open) => {
                if (!open) {
                    captcha.resolve("");
                    usePreviewStore.getState().closeCaptcha();
                }
            }}
        >
            <Dialog.Portal>
                <Dialog.Overlay className="refresher-overlay" style={{background: "transparent"}} />
                <Dialog.Content className="refresher-captcha-popup">
                    <Dialog.Close asChild>
                        <button type="button" className="refresher-popup-close">
                            <X size={14} />
                        </button>
                    </Dialog.Close>

                    <Dialog.Title asChild>
                        <h3>코드 입력</h3>
                    </Dialog.Title>
                    <img src={captcha.url} alt="captcha" />
                    <input
                        autoFocus
                        value={code}
                        placeholder="코드"
                        onKeyDown={(event) => {
                            if (event.key === "Enter") send();
                        }}
                        onChange={(event) => setCode(event.target.value)}
                    />
                    <button type="button" onClick={send}>
                        전송
                    </button>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};

export const Popups = () => {
    const adminVisible = usePreviewStore((s) => s.adminVisible);
    const blockPopup = usePreviewStore((s) => s.blockPopup);
    const captcha = usePreviewStore((s) => s.captcha);

    return (
        <>
            {adminVisible && <AdminPanel />}
            {blockPopup && <BlockPopup />}
            {captcha && <CaptchaPopup key={captcha.url} />}
        </>
    );
};
