import {Checkbox, RadioGroup} from "radix-ui";
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
            <div
                className="close"
                onClick={onClose}
            >
                <div className="cross"></div>
                <div className="cross"></div>
            </div>
            <div className="contents">
                <div className="block">
                    <h3>차단 기간</h3>
                    <RadioGroup.Root
                        className="block_duration"
                        onValueChange={(value) => setAvoidHour(Number(value))}
                        value={String(avoidHour)}
                    >
                        {durations.map((d) => (
                            <label className="ui-option" key={d.value}>
                                <RadioGroup.Item className="ui-radio" value={String(d.value)}>
                                    <RadioGroup.Indicator className="ui-radio-dot"/>
                                </RadioGroup.Item>
                                {d.label}
                            </label>
                        ))}
                    </RadioGroup.Root>
                </div>
                <div className="block">
                    <h3>차단 사유</h3>
                    <RadioGroup.Root
                        className="block_reason"
                        onValueChange={(value) => setAvoidReason(Number(value))}
                        value={String(avoidReason)}
                    >
                        {reasons.map((r) => (
                            <label className="ui-option" key={r.value}>
                                <RadioGroup.Item className="ui-radio" value={String(r.value)}>
                                    <RadioGroup.Indicator className="ui-radio-dot"/>
                                </RadioGroup.Item>
                                {r.label}
                            </label>
                        ))}
                    </RadioGroup.Root>
                    <input
                        name="reason_text"
                        onChange={(ev) => setReasonText(ev.target.value)}
                        placeholder="차단 사유 직접 입력 (한글 20자 이내)"
                        style={avoidReason === 0 ? undefined : {display: "none"}}
                        type="text"
                        value={reasonText}
                    />
                </div>
                <div className="block">
                    <h3>선택한 글 삭제</h3>
                    <label className="ui-option">
                        <Checkbox.Root
                            checked={remove}
                            className="ui-checkbox"
                            onCheckedChange={(value) => setRemove(value === true)}
                        >
                            <Checkbox.Indicator className="ui-check"/>
                        </Checkbox.Root>
                    </label>

                    <h3>식별 코드 차단 시 IP 동시 차단</h3>
                    <label className="ui-option">
                        <Checkbox.Root
                            checked={userType}
                            className="ui-checkbox"
                            onCheckedChange={(value) => setUserType(value === true)}
                        >
                            <Checkbox.Indicator className="ui-check"/>
                        </Checkbox.Root>
                    </label>

                    <button
                        className="go-block"
                        onClick={submit}
                    >
                        차단
                    </button>
                </div>
            </div>
        </div>
    );
}
