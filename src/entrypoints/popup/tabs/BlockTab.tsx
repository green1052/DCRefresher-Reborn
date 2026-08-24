import Bubble from "../components/bubble";
import {PlusIcon, RemoveIcon} from "../components/icons";
import {useAppContext} from "../context";

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
        editBlockMode,
        exportBlock,
        importBlock
    } = blocks;

    return (
        <div className="tab tab2">
            <div className="section-header">
                <h2>데이터 관리</h2>
                <div className="section-actions">
                    <button onClick={() => void exportBlock()}>내보내기</button>
                    <button onClick={() => void importBlock()}>가져오기</button>
                </div>

                <br/>
                <br/>

                <h2>차단 모드</h2>
                {blockTypes.map((key) => (
                    <div
                        className="mode-row"
                        key={key}
                    >
                        <label>{blockKeyNames[key]}:</label>
                        <select
                            onChange={(ev) => {
                                setBlockMode(key, ev.target.value as RefresherBlockDetectMode);
                                void editBlockMode();
                            }}
                            value={blockModes[key] ?? "SAME"}
                        >
                            {Object.entries(blockDetectModeTypeNames).map(([key2, value2]) => (
                                <option
                                    key={key2}
                                    value={key2}
                                >
                                    {value2}
                                </option>
                            ))}
                        </select>
                    </div>
                ))}
            </div>

            {blockTypes.map((key) => (
                <div
                    className="block-divide"
                    key={key}
                >
                    <h3>
                        {blockKeyNames[key]} ({blockLists[key].length}개)
                        <span
                            className="plus"
                            onClick={() => openBlockDialog(key)}
                        >
                            <PlusIcon/>
                        </span>
                        <span
                            className="remove"
                            onClick={() => void removeAllBlockedUser(key)}
                        >
                            <RemoveIcon/>
                        </span>
                    </h3>

                    <div className="lists">
                        {blockLists[key].length === 0 && <p>차단된 {blockKeyNames[key]} 없음</p>}
                        {key !== "DCCON" &&
                            blockLists[key].map((blocked, i) => (
                                <Bubble
                                    extra={blocked.extra}
                                    gallery={blocked.gallery}
                                    isRegex={blocked.isRegex}
                                    key={`block:${i}`}
                                    remove={() => void removeBlockedUser(key, i)}
                                    text={blocked.content}
                                    textclick={() => void editBlockedUser(key, i)}
                                />
                            ))}
                        {key === "DCCON" &&
                            blockLists[key].map((blocked, i) => (
                                <Bubble
                                    extra={blocked.extra}
                                    gallery={blocked.gallery}
                                    image={`https://image.dcinside.com/dccon.php?no=${blocked.isRegex ? (blocked.content.match(/^\^\((\w*)\|/)?.at(1) ?? blocked.content) : blocked.content}`}
                                    isRegex={blocked.isRegex}
                                    key={`block:${i}`}
                                    remove={() => void removeBlockedUser(key, i)}
                                    text={blocked.content}
                                    textclick={() => void editBlockedUser(key, i)}
                                />
                            ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
