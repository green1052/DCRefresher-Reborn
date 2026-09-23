import {Plus, X} from "lucide-react";

import {useAppContext} from "../../popup/context";
import Bubble from "../components/Bubble";

export default function BlockTab() {
    const {blocks} = useAppContext();
    const {
        blocks: blockLists,
        blockModes,
        setBlockMode,
        blockKeyNames,
        blockDetectModeTypeNames,
        blockTypes,
        openBlockDialog,
        removeBlockedUser,
        removeAllBlockedUser,
        editBlockedUser,
        exportBlock,
        importBlock
    } = blocks;

    return (
        <div className="col" style={{gap: 16, paddingTop: 16}}>
            <div className="card">
                <div className="row" style={{gap: 12, marginBottom: 12}}>
                    <div className="heading">데이터 관리</div>
                    <button className="btn btn-soft" onClick={() => void exportBlock()}>내보내기</button>
                    <button className="btn btn-soft" onClick={() => void importBlock()}>가져오기</button>
                </div>

                <div className="heading" style={{marginBottom: 8}}>차단 모드</div>
                <div className="col" style={{gap: 8}}>
                    {blockTypes.map((key) => (
                        <div className="row" style={{gap: 12}} key={key}>
                            <div style={{fontSize: 13, width: 120}}>{blockKeyNames[key]}</div>
                            <select
                                className="native-select"
                                onChange={(ev) => setBlockMode(key, ev.target.value as RefresherBlockDetectMode)}
                                value={blockModes[key] ?? "SAME"}
                            >
                                {Object.entries(blockDetectModeTypeNames).map(([modeKey, label]) => (
                                    <option key={modeKey} value={modeKey}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    ))}
                </div>
            </div>

            {blockTypes.map((key) => (
                <div className="card" key={key}>
                    <div className="row" style={{gap: 8, marginBottom: 12}}>
                        <div className="heading">
                            {blockKeyNames[key]} ({blockLists[key].length}개)
                        </div>
                        <button className="icon-btn" onClick={() => openBlockDialog(key)}>
                            <Plus size={16}/>
                        </button>
                        <button className="icon-btn" onClick={() => void removeAllBlockedUser(key)}>
                            <X size={14}/>
                        </button>
                    </div>

                    <div className="row" style={{gap: 8, flexWrap: "wrap"}}>
                        {blockLists[key].length === 0 && (
                            <div className="text-muted">차단된 {blockKeyNames[key]} 없음</div>
                        )}
                        {blockLists[key].map((blocked, i) => (
                            <Bubble
                                extra={blocked.extra}
                                gallery={blocked.gallery}
                                image={
                                    key === "DCCON"
                                        ? `https://image.dcinside.com/dccon.php?no=${blocked.isRegex ? (blocked.content.match(/^\^\((\w*)\|/)?.at(1) ?? blocked.content) : blocked.content}`
                                        : undefined
                                }
                                key={`${blocked.content}:${i}`}
                                remove={() => void removeBlockedUser(key, blocked.content)}
                                text={blocked.content}
                                textclick={() => void editBlockedUser(key, blocked.content)}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
