import {CloudDownload, CloudUpload, Download, RefreshCw, Trash2, Upload} from "lucide-react";
import {Box, Button, Flex} from "@radix-ui/themes";
import {useEffect, useState} from "react";

import {ConfirmDialog} from "@/components/ConfirmDialog";
import {updateDatabase} from "@/core/database";
import {backupStorage, dbStorage} from "@/core/storage/items";

import {ImportDialog, Section} from "./Layout";

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

    useEffect(() => {
        void dbStorage.getValue().then((db) => setLastUpdate(db.lastUpdate));
        void backupStorage.lastUpdate.getValue().then(setBackupAt);
    }, []);

    const forceUpdate = async (): Promise<void> => {
        setLoading(true);
        try {
            await updateDatabase();
            setLastUpdate((await dbStorage.getValue()).lastUpdate);
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

    const submitImport = async (text: string): Promise<void> => {
        setLoading(true);
        try {
            await replaceLocalStorage(parseImport(text));
            setImportOpen(false);
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
        <Box>
            <Section title="IP/밴 데이터베이스" desc={`마지막 갱신: ${formatTime(lastUpdate)}`}
                     actions={
                         <Button variant="soft" loading={loading} onClick={() => void forceUpdate()}>
                             <RefreshCw size={14}/> 지금 갱신
                         </Button>
                     }/>

            <Section title="클라우드 백업" desc={`브라우저 동기화 저장소에 설정을 백업합니다. 마지막 백업: ${formatTime(backupAt)}`}>
                <Flex gap="2" wrap="wrap">
                    <Button variant="soft" disabled={loading} onClick={() => void backupCloud()}>
                        <CloudUpload size={14}/> 백업
                    </Button>
                    <Button
                        variant="soft"
                        disabled={loading}
                        onClick={() => setConfirming({title: "클라우드 백업으로 현재 설정을 교체할까요?", action: recoverCloud})}
                    >
                        <CloudDownload size={14}/> 복원
                    </Button>
                </Flex>
            </Section>

            <Section title="내보내기 / 가져오기" desc="IP/밴 데이터베이스를 제외한 모든 설정을 JSON으로 옮깁니다.">
                <Flex gap="2" wrap="wrap">
                    <Button variant="soft" disabled={loading} onClick={() => void exportData()}>
                        <Download size={14}/> 클립보드로 내보내기
                    </Button>
                    <Button variant="soft" disabled={loading} onClick={() => setImportOpen(true)}>
                        <Upload size={14}/> 가져오기
                    </Button>
                </Flex>
            </Section>

            <Section title="초기화" desc="모든 설정과 차단/메모 데이터를 삭제합니다. 되돌릴 수 없습니다."
                     actions={
                         <Button
                             variant="soft"
                             color="red"
                             disabled={loading}
                             onClick={() => setConfirming({title: "모든 설정과 사용자 데이터를 초기화할까요?", action: clearData})}
                         >
                             <Trash2 size={14}/> 데이터 초기화
                         </Button>
                     }/>

            <ConfirmDialog open={notice !== null} title={notice ?? ""} cancelLabel={null}
                           onClose={() => setNotice(null)} onConfirm={() => setNotice(null)}/>

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

            <ImportDialog open={importOpen} title="데이터 가져오기"
                          onClose={() => setImportOpen(false)} onSubmit={submitImport}/>
        </Box>
    );
}
