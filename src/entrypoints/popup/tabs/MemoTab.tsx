import Bubble from "../components/bubble";
import {PlusIcon, RemoveIcon} from "../components/icons";
import {useAppContext} from "../context";

export default function MemoTab() {
    const {memos} = useAppContext();
    const {
        memos: memoLists,
        memoKeyNames,
        memoTypes,
        removeMemoUser,
        removeAllMemoUser,
        addMemoUser,
        editMemoUser,
        exportMemo,
        importMemo
    } = memos;

    const open = (url: string) => {
        browser.tabs.create({url});
    };

    return (
        <div className="tab tab3">
            <div className="section-header">
                <h2>데이터 관리</h2>
                <div className="section-actions">
                    <button onClick={() => void exportMemo()}>내보내기</button>
                    <button onClick={() => void importMemo()}>가져오기</button>
                    <button onClick={() => open("https://dcrefresher.green1052.com/utils/convert-memo")}>메모 변환</button>
                </div>
                <br/>
            </div>

            {memoTypes.map((key) => (
                <div
                    className="block-divide"
                    key={key}
                >
                    <h3>
                        {memoKeyNames[key]} ({Object.keys(memoLists[key]).length}개)
                        <span
                            className="plus"
                            onClick={() => void addMemoUser(key)}
                        >
                            <PlusIcon/>
                        </span>
                        <span
                            className="remove"
                            onClick={() => void removeAllMemoUser(key)}
                        >
                            <RemoveIcon/>
                        </span>
                    </h3>

                    <div className="lists">
                        {Object.keys(memoLists[key]).length === 0 && <p>{memoKeyNames[key]} 메모 없음</p>}
                        {Object.entries(memoLists[key]).map(([user, memo]) => (
                            <Bubble
                                key={`memo:${user}`}
                                remove={() => void removeMemoUser(key, user)}
                                text={`${user} (${memo.text.substring(0, 10)})`}
                                textclick={() => void editMemoUser(key, user)}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
