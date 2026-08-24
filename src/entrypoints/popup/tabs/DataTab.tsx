import {useEffect} from "react";

import {useAppContext} from "../context";

export default function DataTab() {
    const {data} = useAppContext();
    const {lastUpdate, loading, refreshLastUpdate, backupCloud, recoverCloud, exportData, importData, clearData} = data;

    useEffect(() => {
        void refreshLastUpdate();
    }, [refreshLastUpdate]);

    return (
        <div className="tab tab6">
            <div className="section-header">
                <h2>데이터 관리</h2>
                <div className="section-actions">
                    <button
                        disabled={loading}
                        onClick={() => void backupCloud()}
                    >
                        클라우드 백업
                    </button>
                    <button
                        disabled={loading}
                        onClick={() => void recoverCloud()}
                    >
                        클라우드 복원
                    </button>
                </div>

                {lastUpdate > 0 && (
                    <p className="data-last-update">
                        마지막 백업: {new Date(lastUpdate).toLocaleString()}
                    </p>
                )}

                <br/>
                <br/>

                <div className="section-actions">
                    <button
                        disabled={loading}
                        onClick={() => void exportData()}
                    >
                        데이터 내보내기
                    </button>
                    <button
                        disabled={loading}
                        onClick={() => void importData()}
                    >
                        데이터 가져오기
                    </button>
                    <button
                        className="danger"
                        disabled={loading}
                        onClick={() => void clearData()}
                    >
                        ⚠️ 데이터 초기화 ⚠️
                    </button>
                </div>
            </div>
        </div>
    );
}
