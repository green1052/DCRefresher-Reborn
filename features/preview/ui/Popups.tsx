import {Button, Card, Checkbox, Dialog, Flex, Grid, Kbd, RadioGroup, Text, TextField} from "@radix-ui/themes";
import {ArrowBigUpDash, Ban, Megaphone, Star, Trash2} from "lucide-react";
import {type ReactNode, useState} from "react";

import {overlay} from "@/components/overlay/shadow";
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
            useUiStore.getState().showToast("차단했습니다.");
            if (delChk) usePreviewStore.getState().requestClose();
            eventBus.emit("refreshRequest");
        } catch {
            useUiStore.getState().showToast("차단 처리 중 오류가 발생했습니다.", "error");
        }
        usePreviewStore.getState().closeBlockPopup();
    };

    return (
        <Dialog.Root open onOpenChange={(open) => !open && usePreviewStore.getState().closeBlockPopup()}>
            <Dialog.Content container={overlay.portal} maxWidth="440px" onOpenAutoFocus={(event) => event.preventDefault()}>
                <Dialog.Title>유저 차단</Dialog.Title>

                <Text as="div" size="2" weight="bold" mb="2">기간</Text>
                <RadioGroup.Root value={day} onValueChange={setDay} size="2">
                    <Grid columns="3" gap="2">
                        {BLOCK_DAYS.map(([value, label]) => (
                            <RadioGroup.Item key={value} value={value}>{label}</RadioGroup.Item>
                        ))}
                    </Grid>
                </RadioGroup.Root>

                <Text as="div" size="2" weight="bold" mt="4" mb="2">사유</Text>
                <RadioGroup.Root value={reason} onValueChange={setReason} size="2">
                    <Grid columns="3" gap="2">
                        {BLOCK_REASONS.map(([value, label]) => (
                            <RadioGroup.Item key={value} value={value}>{label}</RadioGroup.Item>
                        ))}
                    </Grid>
                </RadioGroup.Root>
                {reason === "0" && (
                    <TextField.Root
                        mt="2"
                        value={custom}
                        placeholder="차단 사유 직접 입력 (한글 20자 이내)"
                        maxLength={20}
                        autoFocus
                        onChange={(event) => setCustom(event.target.value)}
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

                <Flex gap="3" justify="end" mt="5">
                    <Dialog.Close>
                        <Button variant="soft" color="gray">취소</Button>
                    </Dialog.Close>
                    <Button color="red" onClick={() => void submit()}>차단</Button>
                </Flex>
            </Dialog.Content>
        </Dialog.Root>
    );
};

const CaptchaPopup = ({captcha}: { captcha: { url: string; resolve: (code: string) => void } }) => {
    const [code, setCode] = useState("");

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
            <Dialog.Content container={overlay.portal} maxWidth="320px">
                <Dialog.Title>코드 입력</Dialog.Title>
                <img src={captcha.url} alt="captcha" style={{display: "block", width: "100%", borderRadius: "var(--radius-3)"}}/>
                <TextField.Root
                    mt="3"
                    autoFocus
                    value={code}
                    placeholder="코드"
                    onKeyDown={(event) => event.key === "Enter" && send()}
                    onChange={(event) => setCode(event.target.value)}
                />
                <Flex gap="3" justify="end" mt="4">
                    <Dialog.Close>
                        <Button variant="soft" color="gray">취소</Button>
                    </Dialog.Close>
                    <Button disabled={!code.trim()} onClick={send}>전송</Button>
                </Flex>
            </Dialog.Content>
        </Dialog.Root>
    );
};

/** 관리 권한이 있을 때 미리보기 왼쪽 가장자리에 붙는 관리 패널 (D/B 두 번 누르기 단축키와 같은 동작) */
const AdminPanel = () => {
    const notice = usePreviewStore((s) => s.notice);
    const recommend = usePreviewStore((s) => s.recommend);
    const requestManage = usePreviewStore((s) => s.requestManage);

    const actions: { label: string; hint?: string; icon: ReactNode; active?: boolean; danger?: boolean; run: () => void }[] = [
        {label: notice ? "공지 해제" : "공지 등록", icon: <Megaphone size={14}/>, active: notice, run: () => requestManage("notice")},
        {label: recommend ? "개념글 해제" : "개념글 등록", icon: <Star size={14}/>, active: recommend, run: () => requestManage("recommend")},
        {label: "끌올", icon: <ArrowBigUpDash size={14}/>, run: () => requestManage("bump")},
        {label: "차단", hint: "B", icon: <Ban size={14}/>, danger: true, run: () => usePreviewStore.getState().openBlockPopup()},
        {label: "삭제", hint: "D", icon: <Trash2 size={14}/>, danger: true, run: () => requestManage("delete")}
    ];

    return (
        <Card size="1" className="refresher-admin-panel refresher-interactive">
            <Text as="div" size="1" color="gray" weight="medium" mb="2" ml="1">관리</Text>
            <Flex direction="column" gap="1">
                {actions.map(({label, hint, icon, active, danger, run}) => (
                    <Button
                        key={label}
                        size="2"
                        // soft 고정 — ghost와 섞으면 Radix 여백이 달라 흔들린다. 상태는 색으로 표시
                        variant="soft"
                        color={danger ? "red" : active ? undefined : "gray"}
                        highContrast={active}
                        aria-pressed={active}
                        style={{justifyContent: "flex-start"}}
                        onClick={run}
                    >
                        {icon}
                        <Text style={{flex: 1, textAlign: "left"}}>{label}</Text>
                        {hint && <Kbd size="1">{hint}</Kbd>}
                    </Button>
                ))}
            </Flex>
        </Card>
    );
};

export const Popups = () => {
    const visible = usePreviewStore((s) => s.visible);
    const adminVisible = usePreviewStore((s) => s.adminVisible);
    const blockPopup = usePreviewStore((s) => s.blockPopup);
    const captcha = usePreviewStore((s) => s.captcha);

    return (
        <>
            {visible && adminVisible && <AdminPanel/>}
            {blockPopup && <BlockPopup/>}
            {captcha && <CaptchaPopup key={captcha.url} captcha={captcha}/>}
        </>
    );
};
