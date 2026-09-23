import {useEffect} from "react";

import {useAppContext} from "../../popup/context";

export default function DataTab() {
    const {data} = useAppContext();
    const {lastUpdate, loading, refreshLastUpdate, backupCloud, recoverCloud, exportData, importData, clearData} = data;

    useEffect(() => {
        void refreshLastUpdate();
    }, [refreshLastUpdate]);

    return (
        <div className="card">
            <div className="col" style={{gap: 16, paddingTop: 16}}>
                <div className="heading">데이터 관리</div>

                <div className="row" style={{gap: 12}}>
                    <button className="btn btn-soft" disabled={loading} onClick={() => void backupCloud()}>
                        클라우드 백업
                    </button>
                    <button className="btn btn-soft" disabled={loading} onClick={() => void recoverCloud()}>
                        클라우드 복원
                    </button>
                </div>

                {lastUpdate > 0 && (
                    <div className="text-muted">
                        마지막 백업: {new Date(lastUpdate).toLocaleString()}
                    </div>
                )}

                <div className="row" style={{gap: 12}}>
                    <button className="btn btn-soft" disabled={loading} onClick={() => void exportData()}>
                        데이터 내보내기
                    </button>
                    <button className="btn btn-soft" disabled={loading} onClick={() => void importData()}>
                        데이터 가져오기
                    </button>
                    <button className="btn btn-danger-soft" disabled={loading} onClick={() => void clearData()}>
                        ⚠️ 데이터 초기화 ⚠️
                    </button>
                </div>
            </div>
        </div>
    );
}
