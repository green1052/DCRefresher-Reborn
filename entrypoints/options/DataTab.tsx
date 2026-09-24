import {RefreshCw} from "lucide-react";
import {Button, Dialog, Flex, Text, TextArea} from "@radix-ui/themes";
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
                <Button size="1" variant="soft" disabled={loading} onClick={() => void forceUpdate()}>
                    <RefreshCw size={12} /> 지금 갱신
                </Button>
            </div>

            <div className="refresher-module-row">
                <div className="refresher-module-text">
                    <div className="refresher-module-name">데이터 관리</div>
                    <div className="refresher-module-desc">마지막 백업: {formatTime(backupAt)}</div>
                </div>
            </div>
            <Flex gap="2" wrap="wrap" pt="2" pb="4">
                <Button size="1" variant="soft" disabled={loading} onClick={() => void backupCloud()}>
                    클라우드 백업
                </Button>
                <Button
                    size="1"
                    variant="soft"
                    disabled={loading}
                    onClick={() => setConfirming({title: "클라우드 백업으로 현재 설정을 교체할까요?", action: recoverCloud})}
                >
                    클라우드 복원
                </Button>
                <Button size="1" variant="soft" disabled={loading} onClick={() => void exportData()}>
                    데이터 내보내기
                </Button>
                <Button size="1" variant="soft" disabled={loading} onClick={() => setImportOpen(true)}>
                    데이터 가져오기
                </Button>
                <Button
                    size="1"
                    variant="soft"
                    color="red"
                    disabled={loading}
                    onClick={() => setConfirming({title: "모든 설정과 사용자 데이터를 초기화할까요?", action: clearData})}
                >
                    데이터 초기화
                </Button>
            </Flex>

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
                <Dialog.Content style={{maxWidth: 520}}>
                    <Dialog.Title>데이터 가져오기</Dialog.Title>
                    <Dialog.Description size="2" mb="3">
                        내보낸 JSON 데이터를 붙여넣어주세요.
                    </Dialog.Description>

                    <TextArea
                        placeholder="JSON 데이터"
                        value={importText}
                        onChange={(event) => setImportText(event.target.value)}
                        style={{minHeight: 160}}
                        autoFocus
                    />

                    <Flex gap="3" justify="end" mt="4">
                        <Dialog.Close>
                            <Button variant="soft" color="gray">
                                취소
                            </Button>
                        </Dialog.Close>
                        <Button disabled={loading} onClick={() => void submitImport()}>
                            가져오기
                        </Button>
                    </Flex>
                </Dialog.Content>
            </Dialog.Root>
        </div>
    );
}
