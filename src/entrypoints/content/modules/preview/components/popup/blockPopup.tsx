import {Button, Checkbox, Flex, IconButton, Select, Text, TextField} from "@radix-ui/themes";
import {X} from "lucide-react";
import {useState} from "react";

import "./blockPopup.scss";

interface BlockPopupPayload {
    avoidHour: number;
    avoidReason: number;
    avoidReasonTxt: string;
    delChk: number;
    userType: number;
}

interface Props {
    onSubmit: (payload: BlockPopupPayload) => void;
    onClose: () => void;
}

const durations = [
    {value: 1, label: "1시간"},
    {value: 6, label: "6시간"},
    {value: 24, label: "24시간"},
    {value: 168, label: "7일"},
    {value: 336, label: "14일"},
    {value: 744, label: "31일"}
];

const reasons = [
    {value: 1, label: "음란성"},
    {value: 2, label: "광고"},
    {value: 3, label: "욕설"},
    {value: 4, label: "도배"},
    {value: 5, label: "저작권 침해"},
    {value: 6, label: "명예훼손"},
    {value: 0, label: "직접 입력"}
];

export default function BlockPopup({onSubmit, onClose}: Props) {
    const [avoidHour, setAvoidHour] = useState(1);
    const [avoidReason, setAvoidReason] = useState(1);
    const [reasonText, setReasonText] = useState("");
    const [remove, setRemove] = useState(false);
    const [userType, setUserType] = useState(false);

    const submit = (): void => {
        onSubmit({
            avoidHour,
            avoidReason,
            avoidReasonTxt: reasonText,
            delChk: remove ? 1 : 0,
            userType: userType ? 1 : 0
        });
    };

    return (
        <div className="refresher-block-popup">
            <IconButton
                color="gray"
                onClick={onClose}
                style={{position: "absolute", right: 10, top: 10}}
                title="닫기"
                variant="ghost"
            >
                <X height={16} width={16}/>
            </IconButton>
            <div className="contents">
                <div className="block">
                    <Text as="div" size="2" weight="bold">차단 기간</Text>
                    <Select.Root
                        onValueChange={(value) => setAvoidHour(Number(value))}
                        size="2"
                        value={String(avoidHour)}
                    >
                        <Select.Trigger mt="2" style={{width: "100%"}}/>
                        <Select.Content>
                            {durations.map((d) => (
                                <Select.Item key={d.value} value={String(d.value)}>
                                    {d.label}
                                </Select.Item>
                            ))}
                        </Select.Content>
                    </Select.Root>
                </div>
                <div className="block">
                    <Text as="div" size="2" weight="bold">차단 사유</Text>
                    <Select.Root
                        onValueChange={(value) => setAvoidReason(Number(value))}
                        size="2"
                        value={String(avoidReason)}
                    >
                        <Select.Trigger mt="2" style={{width: "100%"}}/>
                        <Select.Content>
                            {reasons.map((r) => (
                                <Select.Item key={r.value} value={String(r.value)}>
                                    {r.label}
                                </Select.Item>
                            ))}
                        </Select.Content>
                    </Select.Root>
                    {avoidReason === 0 && (
                        <TextField.Root
                            mt="2"
                            onChange={(ev) => setReasonText(ev.target.value)}
                            placeholder="차단 사유 직접 입력 (한글 20자 이내)"
                            size="2"
                            style={{width: "100%"}}
                            value={reasonText}
                        />
                    )}
                </div>
                <div className="block">
                    <Flex align="center" gap="2">
                        <Checkbox
                            checked={remove}
                            onCheckedChange={(value) => setRemove(value === true)}
                            size="1"
                        />
                        <Text size="2">선택한 글 삭제</Text>
                    </Flex>
                    <Flex align="center" gap="2" mt="2">
                        <Checkbox
                            checked={userType}
                            onCheckedChange={(value) => setUserType(value === true)}
                            size="1"
                        />
                        <Text size="2">식별 코드 차단 시 IP 동시 차단</Text>
                    </Flex>

                    <Button color="red" mt="3" onClick={submit}>차단</Button>
                </div>
            </div>
        </div>
    );
}
