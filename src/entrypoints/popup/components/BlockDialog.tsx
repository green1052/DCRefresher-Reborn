import {useEffect, useState} from "react";

import Checkbox from "./checkbox";
import Options from "./options";
import RefresherInput from "./refresherInput";
import type {BlockFormData} from "../hooks/useBlocks";

const EMPTY_FORM: BlockFormData = {
    content: "",
    isRegex: false,
    gallery: "",
    mode: "NONE"
};

interface Props {
    visible: boolean;
    currentBlockType: string;
    blockKeyNames: Record<string, string>;
    blockDetectModeTypeNames: Record<string, string>;
    onConfirm: (data: BlockFormData) => void;
    onClose: () => void;
}

// 폼 상태는 다이얼로그 로컬. 전역에 두면 글자 1개에 차단 목록 전체가 리렌더된다.
export default function BlockDialog({
    visible,
    currentBlockType,
    blockKeyNames,
    blockDetectModeTypeNames,
    onConfirm,
    onClose
}: Props) {
    const [formData, setFormData] = useState<BlockFormData>(EMPTY_FORM);

    // 열릴 때마다 폼을 비운다.
    useEffect(() => {
        if (visible) setFormData(EMPTY_FORM);
    }, [visible]);

    if (!visible) return null;

    const patch = (p: Partial<BlockFormData>) => setFormData((prev) => ({...prev, ...p}));
    const confirm = () => onConfirm(formData);

    return (
        <div
            className="block-dialog-backdrop"
            onClick={onClose}
        >
            <div
                className="block-dialog-content"
                onClick={(ev) => ev.stopPropagation()}
            >
                <h3 className="head">{blockKeyNames[currentBlockType]} 차단 추가</h3>

                <div className="memo-row">
                    <p>{blockKeyNames[currentBlockType]}</p>
                    <RefresherInput
                        onChange={(v) => patch({content: v})}
                        onKeyUpEnter={confirm}
                        placeholder={`${blockKeyNames[currentBlockType]} 값을 입력하세요`}
                        value={formData.content}
                    />
                </div>

                <div className="memo-row">
                    <p>정규식 사용</p>
                    <Checkbox
                        onChange={(v) => patch({isRegex: v})}
                        value={formData.isRegex}
                    />
                </div>

                <div className="memo-row">
                    <p>특정 갤러리 차단 (선택)</p>
                    <RefresherInput
                        onChange={(v) => patch({gallery: v})}
                        placeholder="갤러리 ID"
                        value={formData.gallery}
                    />
                </div>

                <div className="memo-row">
                    <p>차단 모드</p>
                    <Options
                        onChange={(v) => patch({mode: v as RefresherBlockDetectMode | "NONE"})}
                        options={{NONE: "기본값", ...blockDetectModeTypeNames}}
                        value={formData.mode}
                    />
                </div>

                <div className="button-wrap">
                    <div onClick={confirm}>
                        <p>추가</p>
                    </div>
                    <div onClick={onClose}>
                        <p>취소</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
