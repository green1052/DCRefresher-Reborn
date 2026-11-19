import {ArrowBigUpDash, Ban, Megaphone, Star, Trash2} from "lucide-preact";
import { useEffect, useId, useRef, useState } from "preact/hooks";
import { type ComponentChild as ReactNode } from "preact";

import {DialogActions, DialogDescription, DialogHeader, DialogTitle, ModalDialog, SubmitForm} from "@/components/dialogs";
import {sendMessage, TURNSTILE_CANCEL_EVENT, TURNSTILE_HOST} from "@/core/messaging/protocol";
import {useContentModuleSettings} from "@/core/module/useModuleSettings";
import {BLOCK_DAYS, BLOCK_REASONS, type BlockDay, type BlockReason} from "@/core/preview/types";
import {useUiStore} from "@/stores/ui";
import {cn} from "cn";
import {createDoublePress} from "@/utils/doublePress";
import {focusOnMount} from "@/utils/focus";
import {objectEntries} from "@/utils/typed";

import {DcconInfoPopup} from "./DcconInfoPopup";
import {ImageViewer} from "./ImageViewer";
import {MANAGE_LABELS, type ManageKind, type TurnstilePrompt, usePreviewStore} from "./previewStore";

const RadioGrid = <T extends string, >({label, items, value, onChange}: {
    label: string;
    items: readonly (readonly [T, string])[];
    value: T;
    onChange: (value: T) => void;
}) => {
    const id = useId();
    return (
        <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-x-2 gap-y-1.5">
            {items.map(([item, text]) => (
                <label key={item} className="flex cursor-pointer items-center gap-2">
                    <input type="radio" name={id} checked={value === item} onChange={() => onChange(item)} className="radio radio-sm"/>
                    <span className="text-sm leading-snug font-normal">{text}</span>
                </label>
            ))}
        </div>
    );
};

/** comments: 고른 댓글의 작성자를 차단한다. 없으면 글쓴이를 차단한다. */
const BlockPopup = ({comments}: { comments?: string[] }) => {
    const preData = usePreviewStore((s) => s.preData);
    const [day, setDay] = useState<BlockDay>("1");
    const [reason, setReason] = useState<BlockReason>("1");
    const [custom, setCustom] = useState("");
    const [delChk, setDelChk] = useState(false);
    const [userTypeChk, setUserTypeChk] = useState(false);
    const [sending, setSending] = useState(false);

    const submit = async (): Promise<void> => {
        // 연타로 차단 요청이 두 번 가지 않게 한다.
        if (!preData || sending) return;
        setSending(true);
        const signal = usePreviewStore.getState().signalId;

        const done = await usePreviewStore.getState().requestBlock(preData, {avoidHour: day, avoidReason: reason, avoidReasonTxt: reason === "0" ? custom : "", delChk, userTypeChk}, comments);

        // 그새 다른 글로 넘어갔으면 차단 창과 미리보기는 그 글 것이라 알림만 띄우고 건드리지 않는다. 글도 지웠으면 창은 이미 닫혔다.
        if (usePreviewStore.getState().signalId !== signal) return;
        // 실패하면 입력을 그대로 두어 다시 보낼 수 있게 한다.
        if (!done) setSending(false);
        else usePreviewStore.setState({blockPopup: false});
    };

    return (
        <ModalDialog onClose={() => usePreviewStore.setState({blockPopup: false})} className="sm:max-w-[440px]" focusOnOpen="keyboard">
            <DialogHeader>
                <DialogTitle>{comments ? `댓글 작성자 차단 (${comments.length}개)` : "유저 차단"}</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-2">
                <p className="font-bold">기간</p>
                <RadioGrid label="기간" items={objectEntries(BLOCK_DAYS)} value={day} onChange={setDay}/>
            </div>

            <div className="flex flex-col gap-2">
                <p className="font-bold">사유</p>
                <RadioGrid label="사유" items={BLOCK_REASONS} value={reason} onChange={setReason}/>
                {reason === "0" && (
                    <input
                        className="input w-full"
                        value={custom}
                        aria-label="차단 사유"
                        placeholder="차단 사유 직접 입력 (한글 20자 이내)"
                        maxLength={20}
                        ref={focusOnMount}
                        onInput={(ev) => setCustom(ev.currentTarget.value)}
                    />
                )}
            </div>

            <div className="flex flex-col gap-2">
                <label className="flex items-center gap-3">
                    <input type="checkbox" className="checkbox" checked={delChk} onChange={(ev) => setDelChk(ev.currentTarget.checked)}/>
                    <span className="text-sm leading-snug font-normal">{comments ? "선택한 댓글 삭제" : "선택한 글 삭제"}</span>
                </label>
                <label className="flex items-center gap-3">
                    <input type="checkbox" className="checkbox" checked={userTypeChk} onChange={(ev) => setUserTypeChk(ev.currentTarget.checked)}/>
                    <span className="text-sm leading-snug font-normal">식별 코드 차단 시 IP 동시 차단</span>
                </label>
            </div>

            <DialogActions>
                <button type="button" className="btn btn-error" disabled={sending} onClick={() => void submit()}>
                    {sending && <span aria-hidden className="loading loading-spinner"/>}차단
                </button>
            </DialogActions>
        </ModalDialog>
    );
};

const CaptchaPopup = ({captcha}: { captcha: { url: string; resolve: (code: string) => void } }) => {
    const [code, setCode] = useState("");
    const input = useRef<HTMLInputElement>(null);
    const send = (): void => {
        if (!code.trim()) return;
        captcha.resolve(code.trim());
        usePreviewStore.setState({captcha: null});
    };

    return (
        <ModalDialog
            onClose={() => {
                captcha.resolve("");
                usePreviewStore.setState({captcha: null});
            }}
            className="sm:max-w-[320px]"
            focusOnOpen={input}
        >
            <DialogHeader>
                <DialogTitle>자동입력 방지 코드</DialogTitle>
            </DialogHeader>
            <img src={captcha.url} alt="자동입력 방지 코드" className="block w-full rounded-lg"/>
            <SubmitForm onSubmit={send}>
                <input
                    ref={input}
                    className="input w-full"
                    value={code}
                    aria-label="자동입력 방지 코드"
                    placeholder="자동입력 방지 코드"
                    onInput={(ev) => setCode(ev.currentTarget.value)}
                />
                <DialogActions>
                    <button type="submit" className="btn btn-primary" disabled={!code.trim()}>전송</button>
                </DialogActions>
            </SubmitForm>
        </ModalDialog>
    );
};

/**
 * 확인을 눌러야 하는 Turnstile. 창의 자리(TURNSTILE_HOST)에 페이지가 위젯을 그리고, 토큰을 받으면 창을 닫는다.
 * 닫으면 기다리던 페이지 쪽에 알리고 undefined로 끝낸다 (댓글을 보내지 않는다).
 */
const TurnstilePopup = ({turnstile}: { turnstile: TurnstilePrompt }) => {
    const host = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const element = host.current;
        let done = false;
        void sendMessage("refresher:turnstileToken", {config: turnstile.config, visible: true}).catch(() => undefined).then((result) => {
            done = true;
            turnstile.resolve(result);
            usePreviewStore.setState((state) => (state.turnstile === turnstile ? {turnstile: null} : state));
        });
        return () => {
            if (!done) element?.dispatchEvent(new Event(TURNSTILE_CANCEL_EVENT));
        };
    }, [turnstile]);

    return (
        <ModalDialog
            onClose={() => {
                turnstile.resolve(undefined);
                usePreviewStore.setState({turnstile: null});
            }}
            className="sm:max-w-[360px]"
        >
            <DialogHeader>
                <DialogTitle>보안 확인</DialogTitle>
                <DialogDescription>체크박스를 누르면 댓글을 보냅니다.</DialogDescription>
            </DialogHeader>
            {/* 위젯(300×65)이 뜨기 전에도 자리를 잡아 둔다. */}
            <div ref={host} {...{[TURNSTILE_HOST]: ""}} className="flex min-h-[65px] justify-center"/>
            <DialogActions/>
        </ModalDialog>
    );
};

/** 관리 버튼 두 번 누르기 확인 시간(ms). 이 안에 같은 버튼을 다시 눌러야 실행한다. */
const CONFIRM_WINDOW = 3000;

interface AdminAction {
    id: ManageKind | "block";
    label: string;
    confirm?: string;
    hint?: string;
    icon: ReactNode;
    active?: boolean;
    danger?: boolean;
    /** 두 번 누르기 없이 바로 실행한다. 차단은 옵션 창을 열 뿐이라 그 창이 확인을 겸한다. */
    instant?: boolean;
    run: () => void;
}

/**
 * 관리 권한이 있을 때 미리보기를 연 동안 화면 왼쪽 가장자리에 붙는 관리 패널.
 * 차단 버튼은 차단 키 두 번(프리셋으로 즉시 차단)과 달리 옵션 창을 연다. 나머지는 두 번 눌러야 실행하고, 첫 번째는 토스트로 알린다.
 * Frame이 미리보기 포털 안에 그린다. 나중에 뜬 창(차단, 메모 등)이 패널 위를 덮어야
 * 한 번 클릭에 창 닫기와 관리 동작이 같이 일어나지 않는다.
 */
export const AdminPanel = () => {
    const notice = usePreviewStore((s) => s.preData?.notice === true);
    const recommend = usePreviewStore((s) => s.preData?.recommend === true);
    const requestManage = usePreviewStore((s) => s.requestManage);
    const {useKeyPress, deleteKey, blockKey} = useContentModuleSettings("preview");
    const keys = useKeyPress ? {delete: deleteKey.toUpperCase(), block: blockKey.toUpperCase()} : null;
    // 두 번 누르기 확인 상태. 바뀌어도 다시 그릴 필요가 없어 ref에 둔다.
    const confirmPress = useRef(createDoublePress(CONFIRM_WINDOW)).current;

    // key는 고정된 id로 준다. 라벨을 key로 쓰면 공지, 개념글을 토글할 때 버튼이 새로 마운트돼 포커스가 사라진다.
    const actions: AdminAction[] = [
        {id: "notice", label: notice ? "공지 해제" : "공지 등록", confirm: MANAGE_LABELS.notice[notice ? 1 : 0], icon: <Megaphone className="size-4"/>, active: notice, run: () => requestManage("notice")},
        {id: "recommend", label: recommend ? "개념글 해제" : "개념글 등록", confirm: MANAGE_LABELS.recommend[recommend ? 1 : 0], icon: <Star className="size-4"/>, active: recommend, run: () => requestManage("recommend")},
        {id: "bump", label: "끌올", confirm: "게시글을 끌올", icon: <ArrowBigUpDash className="size-4"/>, run: () => requestManage("bump")},
        {id: "block", label: "차단", hint: keys?.block, icon: <Ban className="size-4"/>, danger: true, instant: true, run: () => usePreviewStore.setState({blockPopup: "post"})},
        {id: "delete", label: "삭제", confirm: "게시글을 삭제", hint: keys?.delete, icon: <Trash2 className="size-4"/>, danger: true, run: () => requestManage("delete")}
    ];

    const press = ({id, label, confirm, instant, run}: AdminAction): void => {
        if (instant) {
            run();
            return;
        }

        // 다른 버튼을 누르거나 늦으면 처음부터 다시 센다. signalId까지 key에 넣어 다른 글로 넘어가도 다시 센다.
        if (confirmPress(`${id}:${usePreviewStore.getState().signalId}`)) {
            run();
            return;
        }

        useUiStore.getState().showToast(`한 번 더 누르면 ${confirm ?? label}합니다.`);
    };

    return (
        <div className="pointer-events-auto fixed top-[20%] left-0 w-[150px] rounded-r-xl bg-base-100 p-2 text-base-content shadow-md ring-1 ring-base-content/10 duration-150 animate-in fade-in">
            <p className="mb-2 ml-1 text-xs font-medium text-base-content/60">관리</p>
            <div className="flex flex-col gap-1">
                {actions.map((action) => (
                    <button
                        type="button"
                        key={action.id}
                        className={cn("btn justify-start", action.danger ? "btn-error" : action.active ? "btn-primary" : "")}
                        // 눌러도 포커스를 가져가지 않는다. 첫 클릭 뒤 스페이스로 스크롤하면 포커스된 버튼이 눌려 두 번째 확인이 된다.
                        onMouseDown={(ev) => ev.preventDefault()}
                        onClick={() => press(action)}
                    >
                        {action.icon}
                        <span className="flex-1 text-left">{action.label}</span>
                        {action.hint && <kbd className="kbd kbd-xs">{action.hint}</kbd>}
                    </button>
                ))}
            </div>
        </div>
    );
};

export const Popups = () => {
    const blockPopup = usePreviewStore((s) => s.blockPopup);
    // 창을 여는 동안 고른 댓글은 그대로다. 창이 열린 채 고른 것을 바꿀 수 없다 (모달).
    const selected = usePreviewStore((s) => s.selectedComments);
    const captcha = usePreviewStore((s) => s.captcha);
    const turnstile = usePreviewStore((s) => s.turnstile);
    const dcconInfo = usePreviewStore((s) => s.dcconInfo);
    const viewer = usePreviewStore((s) => s.viewer);

    return (
        <>
            {blockPopup === "post" && <BlockPopup/>}
            {blockPopup === "comments" && <BlockPopup comments={[...selected]}/>}
            {captcha && <CaptchaPopup key={captcha.url} captcha={captcha}/>}
            {turnstile && <TurnstilePopup turnstile={turnstile}/>}
            {dcconInfo && <DcconInfoPopup key={dcconInfo} code={dcconInfo}/>}
            {viewer && <ImageViewer images={viewer.images} index={viewer.index}/>}
        </>
    );
};
