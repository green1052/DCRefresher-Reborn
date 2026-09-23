import * as Dialog from "@radix-ui/react-dialog";
import * as Select from "@radix-ui/react-select";
import * as Switch from "@radix-ui/react-switch";
import {useEffect, useState} from "react";

import type {BlockFormData} from "../../popup/hooks/useBlocks";
import {useAppContext} from "../../popup/context";

const EMPTY_FORM: BlockFormData = {
    content: "",
    isRegex: false,
    gallery: "",
    mode: "NONE"
};

// 폼 상태는 다이얼로그 로컬. 전역에 두면 글자 1개에 차단 목록 전체가 리렌더된다.
export default function BlockAddDialog() {
    const {blocks} = useAppContext();
    const {
        showBlockDialog,
        currentBlockType,
        blockKeyNames,
        blockDetectModeTypeNames,
        closeBlockDialog,
        confirmAddBlock
    } = blocks;
    const [formData, setFormData] = useState<BlockFormData>(EMPTY_FORM);

    // 열릴 때마다 폼을 비운다.
    useEffect(() => {
        if (showBlockDialog) setFormData(EMPTY_FORM);
    }, [showBlockDialog]);

    const patch = (p: Partial<BlockFormData>) => setFormData((prev) => ({...prev, ...p}));
    const confirm = () => {
        void confirmAddBlock(formData);
        closeBlockDialog();
    };

    return (
        <Dialog.Root
            onOpenChange={(open) => {
                if (!open) closeBlockDialog();
            }}
            open={showBlockDialog}
        >
            <Dialog.Portal>
                <Dialog.Overlay className="dialog-overlay"/>
                <Dialog.Content className="dialog-content">
                    <Dialog.Title className="dialog-title">
                        {blockKeyNames[currentBlockType]} 차단 추가
                    </Dialog.Title>

                    <div className="dialog-body">
                        <div className="row" style={{gap: 12, justifyContent: "space-between"}}>
                            <div style={{fontSize: 13, fontWeight: 500}}>{blockKeyNames[currentBlockType]}</div>
                            <input
                                className="input"
                                onChange={(ev) => patch({content: ev.target.value})}
                                onKeyDown={(ev) => {
                                    if (ev.key === "Enter") confirm();
                                }}
                                placeholder={`${blockKeyNames[currentBlockType]} 값을 입력하세요`}
                                style={{width: 260}}
                                value={formData.content}
                            />
                        </div>

                        <div className="row" style={{gap: 12, justifyContent: "space-between"}}>
                            <div style={{fontSize: 13, fontWeight: 500}}>정규식 사용</div>
                            <Switch.Root
                                checked={formData.isRegex}
                                className="switch"
                                onCheckedChange={(value) => patch({isRegex: value})}
                            >
                                <Switch.Thumb className="switch-thumb"/>
                            </Switch.Root>
                        </div>

                        <div className="row" style={{gap: 12, justifyContent: "space-between"}}>
                            <div style={{fontSize: 13, fontWeight: 500}}>특정 갤러리 차단 (선택)</div>
                            <input
                                className="input"
                                onChange={(ev) => patch({gallery: ev.target.value})}
                                placeholder="갤러리 ID"
                                style={{width: 260}}
                                value={formData.gallery}
                            />
                        </div>

                        <div className="row" style={{gap: 12, justifyContent: "space-between"}}>
                            <div style={{fontSize: 13, fontWeight: 500}}>차단 모드</div>
                            <Select.Root
                                onValueChange={(value) => patch({mode: value as RefresherBlockDetectMode | "NONE"})}
                                value={formData.mode}
                            >
                                <Select.Trigger
                                    aria-label="차단 모드"
                                    className="select-trigger"
                                    style={{width: 260}}
                                >
                                    <Select.Value/>
                                </Select.Trigger>
                                <Select.Portal>
                                    <Select.Content className="select-content">
                                        <Select.Viewport className="select-viewport">
                                            <Select.Item className="select-item" value="NONE">기본값</Select.Item>
                                            {Object.entries(blockDetectModeTypeNames).map(([key, label]) => (
                                                <Select.Item className="select-item" key={key} value={key}>
                                                    {label}
                                                </Select.Item>
                                            ))}
                                        </Select.Viewport>
                                    </Select.Content>
                                </Select.Portal>
                            </Select.Root>
                        </div>

                        <div className="dialog-actions" style={{marginTop: 0}}>
                            <Dialog.Close asChild>
                                <button className="btn btn-soft">취소</button>
                            </Dialog.Close>
                            <button className="btn" onClick={confirm}>추가</button>
                        </div>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
