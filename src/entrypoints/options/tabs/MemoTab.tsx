import {Plus, X} from "lucide-react";

import {useAppContext} from "../../popup/context";
import Bubble from "../components/Bubble";

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
        <div className="col" style={{gap: 16, paddingTop: 16}}>
            <div className="card">
                <div className="row" style={{gap: 12}}>
                    <div className="heading">데이터 관리</div>
                    <button className="btn btn-soft" onClick={() => void exportMemo()}>내보내기</button>
                    <button className="btn btn-soft" onClick={() => void importMemo()}>가져오기</button>
                    <button
                        className="btn btn-soft"
                        onClick={() => open("https://dcrefresher.green1052.com/utils/convert-memo")}
                    >
                        메모 변환
                    </button>
                </div>
            </div>

            {memoTypes.map((key) => (
                <div className="card" key={key}>
                    <div className="row" style={{gap: 8, marginBottom: 12}}>
                        <div className="heading">
                            {memoKeyNames[key]} ({Object.keys(memoLists[key]).length}개)
                        </div>
                        <button className="icon-btn" onClick={() => void addMemoUser(key)}>
                            <Plus size={16}/>
                        </button>
                        <button className="icon-btn" onClick={() => void removeAllMemoUser(key)}>
                            <X size={14}/>
                        </button>
                    </div>

                    <div className="row" style={{gap: 8, flexWrap: "wrap"}}>
                        {Object.keys(memoLists[key]).length === 0 && (
                            <div className="text-muted">{memoKeyNames[key]} 메모 없음</div>
                        )}
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
