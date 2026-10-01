import {Button, Card, Checkbox, Dialog, Flex, Grid, Kbd, RadioGroup, Text, TextField} from "@radix-ui/themes";
import {ArrowBigUpDash, Ban, Megaphone, Star, Trash2} from "lucide-react";
import {type ReactNode, useRef, useState} from "react";
import {objectEntries} from "ts-extras";

import {DialogActions} from "@/components/ConfirmDialog";
import {overlay} from "@/components/overlay/shadow";
import {BLOCK_DAYS, BLOCK_REASONS, type BlockDay, type BlockReason} from "@/core/preview/types";
import {useOpenerFocus} from "@/components/useOpenerFocus";
import {useUiStore} from "@/stores/ui";

import {DcconInfoPopup} from "./DcconInfoPopup";
import {MANAGE_LABELS, type ManageKind, usePreviewStore} from "./previewStore";

/** 고를 수 있는 값만 onChange로 넘긴다 (RadioGroup은 string을 준다) */
const RadioGrid = <T extends string, >({label, items, value, onChange}: {
    label: string;
    items: readonly (readonly [T, string])[];
    value: T;
    onChange: (value: T) => void;
}) => (
    <RadioGroup.Root value={value} onValueChange={(next) => {
        const found = items.find(([item]) => item === next);
        if (found) onChange(found[0]);
    }} size="2" aria-label={label}>
        <Grid columns="3" gap="2">
            {items.map(([item, text]) => <RadioGroup.Item key={item} value={item}>{text}</RadioGroup.Item>)}
        </Grid>
    </RadioGroup.Root>
);

const BlockPopup = () => {
    const preData = usePreviewStore((s) => s.preData);
    const [day, setDay] = useState<BlockDay>("1");
    const [reason, setReason] = useState<BlockReason>("1");
    const [custom, setCustom] = useState("");
    const [delChk, setDelChk] = useState(false);
    const [userTypeChk, setUserTypeChk] = useState(false);
    const [sending, setSending] = useState(false);
    const focus = useOpenerFocus();

    const submit = async (): Promise<void> => {
        // 연타로 차단 요청이 두 번 가지 않게 한다.
        if (!preData || sending) return;
        setSending(true);
        const signal = usePreviewStore.getState().signalId;

        const done = await usePreviewStore.getState().requestBlock(preData, {avoidHour: day, avoidReason: reason, avoidReasonTxt: reason === "0" ? custom : "", delChk, userTypeChk});

        // 그새 다른 글로 넘어갔으면 차단 창과 미리보기는 그 글 것이라 알림만 띄우고 건드리지 않는다. 글도 지웠으면 창은 이미 닫혔다.
        if (usePreviewStore.getState().signalId !== signal) return;
        // 실패하면 입력을 그대로 두어 다시 보낼 수 있게 한다.
        if (!done) setSending(false);
        else usePreviewStore.setState({blockPopup: false});
    };

    return (
        <Dialog.Root open onOpenChange={(open) => !open && usePreviewStore.setState({blockPopup: false})}>
            <Dialog.Content container={overlay.portal} maxWidth="440px" onOpenAutoFocus={focus.onOpenAutoFocus}
                            onCloseAutoFocus={focus.onCloseAutoFocus}>
                <Dialog.Title>유저 차단</Dialog.Title>

                <Text as="div" size="2" weight="bold" mb="2">기간</Text>
                <RadioGrid label="기간" items={objectEntries(BLOCK_DAYS)} value={day} onChange={setDay}/>

                <Text as="div" size="2" weight="bold" mt="4" mb="2">사유</Text>
                <RadioGrid label="사유" items={BLOCK_REASONS} value={reason} onChange={setReason}/>
                {reason === "0" && (
                    <TextField.Root
                        mt="2"
                        value={custom}
                        aria-label="차단 사유"
                        placeholder="차단 사유 직접 입력 (한글 20자 이내)"
                        maxLength={20}
                        autoFocus
                        onChange={(ev) => setCustom(ev.target.value)}
                    />
                )}

                <Flex direction="column" gap="2" mt="4">
                    <Text as="label" size="2">
                        <Flex gap="2" align="center">
                            <Checkbox checked={delChk} onCheckedChange={(value) => setDelChk(value === true)}/>
                            선택한 글 삭제
                        </Flex>
                    </Text>
                    <Text as="label" size="2">
                        <Flex gap="2" align="center">
                            <Checkbox checked={userTypeChk} onCheckedChange={(value) => setUserTypeChk(value === true)}/>
                            식별 코드 차단 시 IP 동시 차단
                        </Flex>
                    </Text>
                </Flex>

                <DialogActions>
                    <Button color="red" loading={sending} onClick={() => void submit()}>차단</Button>
                </DialogActions>
            </Dialog.Content>
        </Dialog.Root>
    );
};

const CaptchaPopup = ({captcha}: { captcha: { url: string; resolve: (code: string) => void } }) => {
    const [code, setCode] = useState("");
    const {onCloseAutoFocus} = useOpenerFocus();

    const send = (): void => {
        if (!code.trim()) return;
        captcha.resolve(code.trim());
        usePreviewStore.setState({captcha: null});
    };

    return (
        <Dialog.Root
            open
            onOpenChange={(open) => {
                if (!open) {
                    captcha.resolve("");
                    usePreviewStore.setState({captcha: null});
                }
            }}
        >
            {/* 섀도 루트 안에선 Dialog의 FocusScope가 입력칸의 autoFocus를 덮으므로 자동 포커스를 막는다 (MemoDialog와 같음) */}
            <Dialog.Content container={overlay.portal} maxWidth="320px" onOpenAutoFocus={(ev) => ev.preventDefault()}
                            onCloseAutoFocus={onCloseAutoFocus}>
                <Dialog.Title>자동입력 방지 코드</Dialog.Title>
                <img src={captcha.url} alt="자동입력 방지 코드" style={{display: "block", width: "100%", borderRadius: "var(--radius-3)"}}/>
                {/* Enter로 보낸다. 폼 제출이라 한글 조합을 끝내는 Enter로는 브라우저가 보내지 않는다 */}
                <form onSubmit={(ev) => {
                    ev.preventDefault();
                    send();
                }}>
                    <TextField.Root
                        mt="3"
                        autoFocus
                        value={code}
                        aria-label="자동입력 방지 코드"
                        placeholder="자동입력 방지 코드"
                        onChange={(ev) => setCode(ev.target.value)}
                    />
                    <DialogActions>
                        <Button type="submit" disabled={!code.trim()}>전송</Button>
                    </DialogActions>
                </form>
            </Dialog.Content>
        </Dialog.Root>
    );
};

/** 관리 버튼 두 번 누르기 확인 시간(ms). 이 안에 같은 버튼을 다시 눌러야 실행한다 */
const CONFIRM_WINDOW = 3000;

interface AdminAction {
    id: ManageKind | "block";
    label: string;
    confirm?: string;
    hint?: string;
    icon: ReactNode;
    active?: boolean;
    danger?: boolean;
    /** 두 번 누르기 없이 바로 실행한다. 차단은 옵션 창을 열 뿐이라 그 창이 확인을 겸한다 */
    instant?: boolean;
    run: () => void;
}

/**
 * 관리 권한이 있을 때 미리보기를 연 동안 화면 왼쪽 가장자리에 붙는 관리 패널.
 * Kbd는 단축키 힌트다. 차단 버튼은 차단 키 두 번(프리셋으로 즉시 차단)과 달리 옵션 창을 연다.
 * 공지·개념글·끌올·삭제는 두 번 눌러야 실행하고, 첫 번째는 토스트로 알린다.
 * 다른 버튼을 누르거나, 늦거나, 다른 글로 넘어가면 처음부터 다시 센다.
 * Frame이 미리보기 포털 안에 그린다. 나중에 뜬 창(차단·메모 등)이 패널 위를 덮어야
 * 한 번 클릭에 창 닫기와 관리 동작이 같이 일어나지 않는다.
 */
export const AdminPanel = () => {
    const notice = usePreviewStore((s) => s.notice);
    const recommend = usePreviewStore((s) => s.recommend);
    const requestManage = usePreviewStore((s) => s.requestManage);
    const keys = usePreviewStore((s) => s.shortcutKeys);
    // 첫 번째로 누른 버튼. 바뀌어도 다시 그릴 필요가 없어 ref에 둔다.
    const armed = useRef<{ id: AdminAction["id"]; signal: number; at: number } | null>(null);

    // key는 고정된 id로 준다. 라벨을 key로 쓰면 공지·개념글을 토글할 때 버튼이 새로 마운트돼 포커스가 사라진다.
    const actions: AdminAction[] = [
        {id: "notice", label: notice ? "공지 해제" : "공지 등록", confirm: MANAGE_LABELS.notice[notice ? 1 : 0], icon: <Megaphone size={14}/>, active: notice, run: () => requestManage("notice")},
        {id: "recommend", label: recommend ? "개념글 해제" : "개념글 등록", confirm: MANAGE_LABELS.recommend[recommend ? 1 : 0], icon: <Star size={14}/>, active: recommend, run: () => requestManage("recommend")},
        {id: "bump", label: "끌올", confirm: "게시글을 끌올", icon: <ArrowBigUpDash size={14}/>, run: () => requestManage("bump")},
        {id: "block", label: "차단", hint: keys?.block, icon: <Ban size={14}/>, danger: true, instant: true, run: () => usePreviewStore.setState({blockPopup: true})},
        {id: "delete", label: "삭제", confirm: "게시글을 삭제", hint: keys?.delete, icon: <Trash2 size={14}/>, danger: true, run: () => requestManage("delete")}
    ];

    const press = ({id, label, confirm, instant, run}: AdminAction): void => {
        if (instant) {
            run();
            return;
        }

        const now = Date.now();
        const signal = usePreviewStore.getState().signalId;
        const prev = armed.current;
        if (prev?.id === id && prev.signal === signal && now - prev.at < CONFIRM_WINDOW) {
            armed.current = null;
            run();
            return;
        }

        armed.current = {id, signal, at: now};
        useUiStore.getState().showToast(`한 번 더 누르면 ${confirm ?? label}합니다.`);
    };

    return (
        <Card size="1" className="refresher-admin-panel refresher-interactive">
            <Text as="div" size="1" color="gray" weight="medium" mb="2" ml="1">관리</Text>
            <Flex direction="column" gap="1">
                {actions.map((action) => (
                    <Button
                        key={action.id}
                        size="2"
                        // variant는 soft로 고정한다. ghost와 섞으면 Radix 여백이 달라 버튼이 흔들리므로 상태는 색으로 보인다.
                        variant="soft"
                        color={action.danger ? "red" : action.active ? undefined : "gray"}
                        highContrast={action.active}
                        style={{justifyContent: "flex-start"}}
                        // 눌러도 포커스를 가져가지 않는다. 첫 클릭 뒤 스페이스로 스크롤하면 포커스된 버튼이 눌려 두 번째 확인이 된다
                        onMouseDown={(ev) => ev.preventDefault()}
                        onClick={() => press(action)}
                    >
                        {action.icon}
                        <Text style={{flex: 1, textAlign: "left"}}>{action.label}</Text>
                        {action.hint && <Kbd size="1">{action.hint}</Kbd>}
                    </Button>
                ))}
            </Flex>
        </Card>
    );
};

export const Popups = () => {
    const blockPopup = usePreviewStore((s) => s.blockPopup);
    const captcha = usePreviewStore((s) => s.captcha);
    const dcconInfo = usePreviewStore((s) => s.dcconInfo);

    return (
        <>
            {blockPopup && <BlockPopup/>}
            {captcha && <CaptchaPopup key={captcha.url} captcha={captcha}/>}
            {dcconInfo && <DcconInfoPopup key={dcconInfo} code={dcconInfo}/>}
        </>
    );
};
