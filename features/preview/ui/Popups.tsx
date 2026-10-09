import {ArrowBigUpDash, Ban, Megaphone, Star, Trash2} from "lucide-react";
import {type ReactNode, useId, useRef, useState} from "react";

import {DialogActions, ModalDialog, SubmitForm} from "@/components/dialogs";
import {Button} from "@/components/ui/button";
import {Checkbox} from "@/components/ui/checkbox";
import {DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Field, FieldLabel} from "@/components/ui/field";
import {Input} from "@/components/ui/input";
import {Kbd} from "@/components/ui/kbd";
import {RadioGroup, RadioGroupItem} from "@/components/ui/radio-group";
import {Spinner} from "@/components/ui/spinner";
import {useContentModuleSettings} from "@/core/module/useModuleSettings";
import {BLOCK_DAYS, BLOCK_REASONS, type BlockDay, type BlockReason} from "@/core/preview/types";
import {useUiStore} from "@/stores/ui";
import {createDoublePress} from "@/utils/doublePress";
import {focusOnMount} from "@/utils/focus";
import {objectEntries} from "@/utils/typed";

import {DcconInfoPopup} from "./DcconInfoPopup";
import {ImageViewer} from "./ImageViewer";
import {MANAGE_LABELS, type ManageKind, usePreviewStore} from "./previewStore";

/** 고를 수 있는 값만 onChange로 넘긴다 (RadioGroup은 unknown을 준다). */
const RadioGrid = <T extends string, >({label, items, value, onChange}: {
    label: string;
    items: readonly (readonly [T, string])[];
    value: T;
    onChange: (value: T) => void;
}) => {
    const id = useId();
    return (
        <RadioGroup value={value} aria-label={label} className="grid-cols-3" onValueChange={(next) => {
            const found = items.find(([item]) => item === next);
            if (found) onChange(found[0]);
        }}>
            {items.map(([item, text]) => (
                <Field key={item} orientation="horizontal">
                    <RadioGroupItem id={`${id}-${item}`} value={item}/>
                    <FieldLabel htmlFor={`${id}-${item}`} className="font-normal">{text}</FieldLabel>
                </Field>
            ))}
        </RadioGroup>
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
    const id = useId();

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
                    <Input
                        value={custom}
                        aria-label="차단 사유"
                        placeholder="차단 사유 직접 입력 (한글 20자 이내)"
                        maxLength={20}
                        ref={focusOnMount}
                        onChange={(ev) => setCustom(ev.target.value)}
                    />
                )}
            </div>

            <div className="flex flex-col gap-2">
                <Field orientation="horizontal">
                    <Checkbox id={`${id}-del`} checked={delChk} onCheckedChange={setDelChk}/>
                    <FieldLabel htmlFor={`${id}-del`} className="font-normal">{comments ? "선택한 댓글 삭제" : "선택한 글 삭제"}</FieldLabel>
                </Field>
                <Field orientation="horizontal">
                    <Checkbox id={`${id}-ip`} checked={userTypeChk} onCheckedChange={setUserTypeChk}/>
                    <FieldLabel htmlFor={`${id}-ip`} className="font-normal">식별 코드 차단 시 IP 동시 차단</FieldLabel>
                </Field>
            </div>

            <DialogActions>
                <Button variant="destructive" disabled={sending} onClick={() => void submit()}>
                    {sending && <Spinner data-icon="inline-start"/>}차단
                </Button>
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
            {/* Enter로 보낸다 (SubmitForm). */}
            <SubmitForm onSubmit={send} className="flex flex-col gap-4">
                <Input
                    ref={input}
                    value={code}
                    aria-label="자동입력 방지 코드"
                    placeholder="자동입력 방지 코드"
                    onChange={(ev) => setCode(ev.target.value)}
                />
                <DialogActions>
                    <Button type="submit" disabled={!code.trim()}>전송</Button>
                </DialogActions>
            </SubmitForm>
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
 * Frame이 미리보기 포털 안에 그린다. 나중에 뜬 창(차단·메모 등)이 패널 위를 덮어야
 * 한 번 클릭에 창 닫기와 관리 동작이 같이 일어나지 않는다.
 */
export const AdminPanel = () => {
    const notice = usePreviewStore((s) => s.notice);
    const recommend = usePreviewStore((s) => s.recommend);
    const requestManage = usePreviewStore((s) => s.requestManage);
    const {useKeyPress, deleteKey, blockKey} = useContentModuleSettings("preview");
    const keys = useKeyPress ? {delete: deleteKey.toUpperCase(), block: blockKey.toUpperCase()} : null;
    // 두 번 누르기 확인 상태. 바뀌어도 다시 그릴 필요가 없어 ref에 둔다.
    const confirmPress = useRef(createDoublePress(CONFIRM_WINDOW)).current;

    // key는 고정된 id로 준다. 라벨을 key로 쓰면 공지·개념글을 토글할 때 버튼이 새로 마운트돼 포커스가 사라진다.
    const actions: AdminAction[] = [
        {id: "notice", label: notice ? "공지 해제" : "공지 등록", confirm: MANAGE_LABELS.notice[notice ? 1 : 0], icon: <Megaphone data-icon="inline-start"/>, active: notice, run: () => requestManage("notice")},
        {id: "recommend", label: recommend ? "개념글 해제" : "개념글 등록", confirm: MANAGE_LABELS.recommend[recommend ? 1 : 0], icon: <Star data-icon="inline-start"/>, active: recommend, run: () => requestManage("recommend")},
        {id: "bump", label: "끌올", confirm: "게시글을 끌올", icon: <ArrowBigUpDash data-icon="inline-start"/>, run: () => requestManage("bump")},
        {id: "block", label: "차단", hint: keys?.block, icon: <Ban data-icon="inline-start"/>, danger: true, instant: true, run: () => usePreviewStore.setState({blockPopup: "post"})},
        {id: "delete", label: "삭제", confirm: "게시글을 삭제", hint: keys?.delete, icon: <Trash2 data-icon="inline-start"/>, danger: true, run: () => requestManage("delete")}
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
        <div className="pointer-events-auto fixed top-[20%] left-0 w-[150px] rounded-r-xl bg-card p-2 text-card-foreground shadow-md ring-1 ring-foreground/10 duration-150 animate-in fade-in">
            <p className="mb-2 ml-1 text-xs font-medium text-muted-foreground">관리</p>
            <div className="flex flex-col gap-1">
                {actions.map((action) => (
                    <Button
                        key={action.id}
                        // 상태는 색으로 보인다: 위험한 동작은 빨강, 켜진 공지·개념글은 강조색.
                        variant={action.danger ? "destructive" : action.active ? "default" : "secondary"}
                        className="justify-start"
                        // 눌러도 포커스를 가져가지 않는다. 첫 클릭 뒤 스페이스로 스크롤하면 포커스된 버튼이 눌려 두 번째 확인이 된다.
                        onMouseDown={(ev) => ev.preventDefault()}
                        onClick={() => press(action)}
                    >
                        {action.icon}
                        <span className="flex-1 text-left">{action.label}</span>
                        {action.hint && <Kbd>{action.hint}</Kbd>}
                    </Button>
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
    const dcconInfo = usePreviewStore((s) => s.dcconInfo);
    const viewer = usePreviewStore((s) => s.viewer);

    return (
        <>
            {blockPopup === "post" && <BlockPopup/>}
            {blockPopup === "comments" && <BlockPopup comments={[...selected]}/>}
            {captcha && <CaptchaPopup key={captcha.url} captcha={captcha}/>}
            {dcconInfo && <DcconInfoPopup key={dcconInfo} code={dcconInfo}/>}
            {viewer && <ImageViewer images={viewer.images} index={viewer.index}/>}
        </>
    );
};
