import {RefreshCw} from "lucide-react";
import {useEffect, useState} from "react";

import {DatabaseService} from "@/core/services/database";

const formatTime = (lastUpdate: number): string =>
    lastUpdate === 0 ? "기록 없음" : new Date(lastUpdate).toLocaleString("ko-KR");

export function DataTab() {
    const [lastUpdate, setLastUpdate] = useState(0);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        void DatabaseService.lastUpdate().then(setLastUpdate);
    }, []);

    const forceUpdate = async () => {
        setLoading(true);
        try {
            await DatabaseService.forceUpdate();
            setLastUpdate(await DatabaseService.lastUpdate());
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <div className="refresher-module-row">
                <div className="refresher-module-text">
                    <div className="refresher-module-name">IP/밴 데이터베이스</div>
                    <div className="refresher-module-desc">마지막 갱신: {formatTime(lastUpdate)}</div>
                </div>
                <button className="refresher-button" disabled={loading} onClick={() => void forceUpdate()}>
                    <RefreshCw size={12} /> 지금 갱신
                </button>
            </div>
            <div className="empty">백업/복원 (M5)</div>
        </div>
    );
}
