import Checkbox from "./checkbox";
import Options from "./options";
import RefresherInput from "./refresherInput";
import type {BlockFormData} from "../hooks/useBlocks";

interface Props {
    visible: boolean;
    currentBlockType: string;
    blockKeyNames: Record<string, string>;
    blockDetectModeTypeNames: Record<string, string>;
    formData: BlockFormData;
    onChange: (patch: Partial<BlockFormData>) => void;
    onConfirm: () => void;
    onClose: () => void;
}

export default function BlockDialog({
    visible,
    currentBlockType,
    blockKeyNames,
    blockDetectModeTypeNames,
    formData,
    onChange,
    onConfirm,
    onClose
}: Props) {
    if (!visible) return null;

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
                        onChange={(v) => onChange({content: v})}
                        onKeyUpEnter={onConfirm}
                        placeholder={`${blockKeyNames[currentBlockType]} 값을 입력하세요`}
                        value={formData.content}
                    />
                </div>

                <div className="memo-row">
                    <p>정규식 사용</p>
                    <Checkbox
                        onChange={(v) => onChange({isRegex: v})}
                        value={formData.isRegex}
                    />
                </div>

                <div className="memo-row">
                    <p>특정 갤러리 차단 (선택)</p>
                    <RefresherInput
                        onChange={(v) => onChange({gallery: v})}
                        placeholder="갤러리 ID"
                        value={formData.gallery}
                    />
                </div>

                <div className="memo-row">
                    <p>차단 모드</p>
                    <Options
                        onChange={(v) => onChange({mode: v as RefresherBlockDetectMode | "NONE"})}
                        options={{NONE: "기본값", ...blockDetectModeTypeNames}}
                        value={formData.mode}
                    />
                </div>

                <div className="button-wrap">
                    <div onClick={onConfirm}>
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
