import {RefreshCw} from "lucide-react";
import {Dialog} from "radix-ui";
import {useEffect, useState} from "react";

import {ConfirmDialog} from "@/components/ConfirmDialog";
import {DatabaseService} from "@/core/services/database";
import {backupStorage, dbStorage} from "@/core/storage/items";

const formatTime = (lastUpdate: number): string =>
    lastUpdate === 0 ? "기록 없음" : new Date(lastUpdate).toLocaleString("ko-KR");

/** IP/밴 DB는 용량이 커서 백업/내보내기에서 제외 */
const getLocalDataWithoutDatabase = async (): Promise<Record<string, unknown>> => {
    const data = (await browser.storage.local.get(null)) as Record<string, unknown>;
    delete data["refresher:db"];
    return data;
};

const replaceLocalStorage = async (data: Record<string, unknown>): Promise<void> => {
    const previous = (await browser.storage.local.get(null)) as Record<string, unknown>;

    try {
        await browser.storage.local.clear();
        await browser.storage.local.set(data);
    } catch (error) {
        await browser.storage.local.clear();
        await browser.storage.local.set(previous);
        throw error;
    }
};

const parseImport = (input: string): Record<string, unknown> => {
    const parsed = JSON.parse(input) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("가져오기 데이터는 JSON 객체여야 합니다.");
    }
    return parsed as Record<string, unknown>;
};

interface ConfirmState {
    title: string;
    action: () => Promise<void>;
}

export function DataTab() {
    const [lastUpdate, setLastUpdate] = useState(0);
    const [backupAt, setBackupAt] = useState(0);
    const [loading, setLoading] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [confirming, setConfirming] = useState<ConfirmState | null>(null);
    const [importOpen, setImportOpen] = useState(false);
    const [importText, setImportText] = useState("");

    useEffect(() => {
        void DatabaseService.lastUpdate().then(setLastUpdate);
        void backupStorage.lastUpdate.getValue().then(setBackupAt);
    }, []);

    const forceUpdate = async (): Promise<void> => {
        setLoading(true);
        try {
            await DatabaseService.forceUpdate();
            setLastUpdate(await DatabaseService.lastUpdate());
        } finally {
            setLoading(false);
        }
    };

    const backupCloud = async (): Promise<void> => {
        setLoading(true);
        try {
            const data = await getLocalDataWithoutDatabase();

            await browser.storage.sync.clear();
            await browser.storage.sync.set(data);

            const now = Date.now();
            setBackupAt(now);
            await backupStorage.lastUpdate.setValue(now);
            setNotice("데이터를 클라우드에 백업했습니다.");
        } catch {
            setNotice("데이터를 클라우드에 백업하는데 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const recoverCloud = async (): Promise<void> => {
        setLoading(true);
        try {
            const [data, db] = await Promise.all([browser.storage.sync.get(), dbStorage.getValue()]);
            const merged: Record<string, unknown> = {...data};
            if (db.ip && Object.keys(db.ip).length > 0) merged["refresher:db"] = db;

            await replaceLocalStorage(merged);
            setNotice("데이터를 복원했습니다. 새 탭에서 디시인사이드를 열어주세요.");
        } catch {
            setNotice("데이터를 복원하는데 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const exportData = async (): Promise<void> => {
        setLoading(true);
        try {
            const data = await getLocalDataWithoutDatabase();
            await navigator.clipboard.writeText(JSON.stringify(data));
            setNotice("데이터를 클립보드로 내보냈습니다.");
        } catch {
            setNotice("데이터를 클립보드로 내보내는데 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const submitImport = async (): Promise<void> => {
        setLoading(true);
        try {
            await replaceLocalStorage(parseImport(importText));
            setImportOpen(false);
            setImportText("");
            setNotice("데이터를 가져왔습니다. 새 탭에서 디시인사이드를 열어주세요.");
        } catch {
            setNotice("데이터를 가져오는데 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const clearData = async (): Promise<void> => {
        setLoading(true);
        try {
            await browser.storage.local.clear();
            setNotice("데이터를 초기화했습니다. 새 탭에서 디시인사이드를 열어주세요.");
        } catch {
            setNotice("데이터를 초기화하는데 실패했습니다.");
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

            <div className="refresher-module-row">
                <div className="refresher-module-text">
                    <div className="refresher-module-name">데이터 관리</div>
                    <div className="refresher-module-desc">마지막 백업: {formatTime(backupAt)}</div>
                </div>
            </div>
            <div className="refresher-data-actions">
                <button className="refresher-button" disabled={loading} onClick={() => void backupCloud()}>
                    클라우드 백업
                </button>
                <button
                    className="refresher-button"
                    disabled={loading}
                    onClick={() => setConfirming({title: "클라우드 백업으로 현재 설정을 교체할까요?", action: recoverCloud})}
                >
                    클라우드 복원
                </button>
                <button className="refresher-button" disabled={loading} onClick={() => void exportData()}>
                    데이터 내보내기
                </button>
                <button className="refresher-button" disabled={loading} onClick={() => setImportOpen(true)}>
                    데이터 가져오기
                </button>
                <button
                    className="refresher-button"
                    disabled={loading}
                    onClick={() => setConfirming({title: "모든 설정과 사용자 데이터를 초기화할까요?", action: clearData})}
                >
                    ⚠️ 데이터 초기화 ⚠️
                </button>
            </div>

            <ConfirmDialog open={notice !== null} title={notice ?? ""} cancelLabel={null} onClose={() => setNotice(null)} onConfirm={() => setNotice(null)} />

            <ConfirmDialog
                open={confirming !== null}
                title={confirming?.title ?? ""}
                confirmLabel="확인"
                danger
                onConfirm={() => {
                    const target = confirming;
                    setConfirming(null);
                    if (target) void target.action();
                }}
                onClose={() => setConfirming(null)}
            />

            <Dialog.Root open={importOpen} onOpenChange={(next) => !next && setImportOpen(false)}>
                <Dialog.Portal>
                    <Dialog.Overlay className="refresher-overlay" />
                    <Dialog.Content className="refresher-dialog">
                        <Dialog.Title className="refresher-dialog-title">데이터 가져오기</Dialog.Title>
                        <Dialog.Description className="refresher-dialog-desc">내보낸 JSON 데이터를 붙여넣어주세요.</Dialog.Description>

                        <textarea
                            className="refresher-textarea"
                            placeholder="JSON 데이터"
                            value={importText}
                            onChange={(event) => setImportText(event.target.value)}
                            autoFocus
                        />

                        <div className="refresher-dialog-actions">
                            <Dialog.Close asChild>
                                <button type="button" className="refresher-button">
                                    취소
                                </button>
                            </Dialog.Close>
                            <button type="button" className="refresher-button refresher-primary" disabled={loading} onClick={() => void submitImport()}>
                                가져오기
                            </button>
                        </div>

                        <Dialog.Close asChild>
                            <button type="button" className="refresher-dialog-close" aria-label="닫기">
                                ×
                            </button>
                        </Dialog.Close>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </div>
    );
}
