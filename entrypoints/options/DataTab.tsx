import {CloudDownload, CloudUpload, Download, RefreshCw, Trash2, Upload} from "lucide-react";
import {Box, Button, Flex, Switch, Text} from "@radix-ui/themes";
import {useEffect, useState} from "react";

import {ConfirmDialog} from "@/components/ConfirmDialog";
import {collectLocalData, isBackupTarget, readCloudBackup, runBackup} from "@/core/backup";
import {updateDatabase} from "@/core/database";
import {backupStorage, dbStorage} from "@/core/storage/items";

import {ImportDialog, Section} from "./Layout";

const formatTime = (lastUpdate: number): string =>
    lastUpdate === 0 ? "기록 없음" : new Date(lastUpdate).toLocaleString("ko-KR");

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * 설정(백업 대상 키)만 갈아끼운다 — IP/밴 DB·백업 상태·모듈 캐시는 그대로 둔다.
 * 쓰다가 실패하면 이전 값으로 되돌린다.
 */
const replaceSettings = async (data: Record<string, unknown>): Promise<void> => {
    const previous = (await browser.storage.local.get(null)) as Record<string, unknown>;
    const next = Object.fromEntries(Object.entries(data).filter(([key]) => isBackupTarget(key)));
    const removed = Object.keys(previous).filter((key) => isBackupTarget(key) && !(key in next));

    try {
        await browser.storage.local.remove(removed);
        await browser.storage.local.set(next);
    } catch (error) {
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
    const [backupError, setBackupError] = useState("");
    const [autoBackup, setAutoBackup] = useState(false);
    const [loading, setLoading] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [confirming, setConfirming] = useState<ConfirmState | null>(null);
    const [importOpen, setImportOpen] = useState(false);

    useEffect(() => {
        void dbStorage.getValue().then((db) => setLastUpdate(db.lastUpdate));
        void backupStorage.lastUpdate.getValue().then(setBackupAt);
        void backupStorage.error.getValue().then(setBackupError);
        void backupStorage.auto.getValue().then(setAutoBackup);

        // 자동 백업은 백그라운드에서 돈다 — 결과를 따라간다
        const unwatch = [
            backupStorage.lastUpdate.watch((value) => setBackupAt(value ?? 0)),
            backupStorage.error.watch((value) => setBackupError(value ?? ""))
        ];
        return () => unwatch.forEach((stop) => stop());
    }, []);

    const run = async (action: () => Promise<string>, failure: string): Promise<void> => {
        setLoading(true);
        try {
            setNotice(await action());
        } catch (error) {
            setNotice(`${failure} ${errorMessage(error)}`);
        } finally {
            setLoading(false);
        }
    };

    const forceUpdate = async (): Promise<void> => {
        setLoading(true);
        try {
            await updateDatabase();
            setLastUpdate((await dbStorage.getValue()).lastUpdate);
        } finally {
            setLoading(false);
        }
    };

    const backupCloud = () =>
        run(async () => {
            await runBackup();
            return "데이터를 클라우드에 백업했습니다.";
        }, "클라우드에 백업하지 못했습니다.");

    const recoverCloud = () =>
        run(async () => {
            const backup = await readCloudBackup();
            if (!backup) return "클라우드에 백업이 없습니다.";

            await replaceSettings(backup.data);
            return `${backup.createdAt ? `${formatTime(backup.createdAt)} 백업을` : "데이터를"} 복원했습니다. 새 탭에서 디시인사이드를 열어주세요.`;
        }, "복원하지 못했습니다.");

    const toggleAutoBackup = async (on: boolean): Promise<void> => {
        setAutoBackup(on);
        await backupStorage.auto.setValue(on);
        // 켜는 순간의 설정을 바로 올려 둔다 (이후엔 바뀔 때마다 백그라운드가)
        if (on) await backupCloud();
    };

    const exportData = () =>
        run(async () => {
            await navigator.clipboard.writeText(JSON.stringify(await collectLocalData()));
            return "데이터를 클립보드로 내보냈습니다.";
        }, "클립보드로 내보내지 못했습니다.");

    const submitImport = (text: string) =>
        run(async () => {
            await replaceSettings(parseImport(text));
            setImportOpen(false);
            return "데이터를 가져왔습니다. 새 탭에서 디시인사이드를 열어주세요.";
        }, "가져오지 못했습니다.");

    const clearData = () =>
        run(async () => {
            await replaceSettings({});
            return "데이터를 초기화했습니다. 새 탭에서 디시인사이드를 열어주세요.";
        }, "초기화하지 못했습니다.");

    return (
        <Box>
            <Section title="IP/밴 데이터베이스" desc={`마지막 갱신: ${formatTime(lastUpdate)}`}
                     actions={
                         <Button variant="soft" loading={loading} onClick={() => void forceUpdate()}>
                             <RefreshCw size={14}/> 지금 갱신
                         </Button>
                     }/>

            <Section
                title="클라우드 백업"
                desc={`브라우저 동기화 저장소(최대 100KB)에 설정을 압축해 백업합니다. 마지막 백업: ${formatTime(backupAt)}`}
                actions={
                    <Text as="label" size="2">
                        <Flex gap="2" align="center">
                            <Switch checked={autoBackup} disabled={loading} onCheckedChange={(on) => void toggleAutoBackup(on)}/>
                            자동 백업
                        </Flex>
                    </Text>
                }
            >
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
                {autoBackup && (
                    <Text as="p" size="1" color="gray" mt="2">설정이 바뀌면 1분 뒤에 자동으로 백업합니다.</Text>
                )}
                {backupError && (
                    <Text as="p" size="1" color="red" mt="2">마지막 백업 실패: {backupError}</Text>
                )}
            </Section>

            <Section title="내보내기 / 가져오기" desc="IP/밴 데이터베이스와 캐시를 뺀 모든 설정을 JSON으로 옮깁니다.">
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
